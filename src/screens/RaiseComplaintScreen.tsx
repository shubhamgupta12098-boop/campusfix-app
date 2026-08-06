import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadDataUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card } from '@/components/ui';
import { PRIORITY_CONFIG } from '@/lib/constants';
import type { ComplaintPriority } from '@/lib/supabase';
import { Camera, X, MapPin, Send, AlertCircle } from 'lucide-react';

const FIXED_CATEGORIES = [
  { id: 'electrical', name: 'Electrical', sla_hours: 24 },
  { id: 'plumbing', name: 'Plumbing', sla_hours: 24 },
  { id: 'furniture', name: 'Furniture', sla_hours: 72 },
  { id: 'it-network', name: 'IT / Network', sla_hours: 24 },
  { id: 'cleanliness', name: 'Cleanliness', sla_hours: 12 },
  { id: 'other', name: 'Other', sla_hours: 48 },
] as const;

const readAndCompressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('The selected file is not a valid image.'));
      img.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Image processing is not supported.'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.68));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

export function RaiseComplaintScreen({ onDone }: { onDone: () => void }) {
  const { profile } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('electrical');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [room, setRoom] = useState('');
  const [locationDesc, setLocationDesc] = useState('');
  const [priority, setPriority] = useState<ComplaintPriority>('medium');
  const [photos, setPhotos] = useState<string[]>([]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - photos.length);
    if (!files.length) return;
    try {
      const next: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) throw new Error('Please select JPG or PNG images only.');
        if (file.size > 8 * 1024 * 1024) throw new Error('Each image must be smaller than 8 MB.');
        next.push(await readAndCompressImage(file));
      }
      setPhotos((prev) => [...prev, ...next].slice(0, 3));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not attach the image.');
    } finally {
      e.target.value = '';
    }
  };

  const removePhoto = (idx: number) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!profile?.id) return setError('Please sign in again before submitting a complaint.');
    if (!title.trim() || !description.trim() || !categoryId) return setError('Please fill in all required fields.');
    if (!building.trim() || !floor.trim() || !room.trim()) return setError('Please enter building, floor and room/location.');

    setSubmitting(true);
    const selectedCat = FIXED_CATEGORIES.find((c) => c.id === categoryId)!;
    const now = new Date();
    const expectedCompletion = new Date(now.getTime() + selectedCat.sla_hours * 60 * 60 * 1000);
    const complaintNo = `CMP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-6)}`;
    const fullLocation = [
      `Building: ${building.trim()}`,
      `Floor: ${floor.trim()}`,
      `Room/Area: ${room.trim()}`,
      locationDesc.trim(),
    ].filter(Boolean).join(' | ');

    let uploadedPhotos: string[] = [];
    try {
      uploadedPhotos = await Promise.all(photos.map((photo, index) => uploadDataUrl(photo, `complaint-${Date.now()}-${index}.jpg`)));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Complaint photos could not be uploaded.');
      setSubmitting(false);
      return;
    }

    const result = await supabase.from('complaints').insert({
      complaint_no: complaintNo,
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId,
      category_name: selectedCat.name,
      user_id: profile.id,
      building_id: null,
      floor: Number.isFinite(Number(floor)) ? Number(floor) : null,
      location_description: fullLocation,
      priority,
      status: 'submitted',
      photo_urls: uploadedPhotos,
      escalation_level: 0,
      expected_completion: expectedCompletion.toISOString(),
    }).select('id').single();

    if (result.error || !result.data) {
      setError(result.error?.message || 'Complaint could not be saved. Please try again.');
      setSubmitting(false);
      return;
    }

    const complaintId = (result.data as { id: string }).id;
    await supabase.from('complaint_status_history').insert({
      complaint_id: complaintId,
      old_status: null,
      new_status: 'submitted',
      changed_by: profile.id,
      remarks: 'Complaint submitted',
    });

    // Notifications must never block complaint filing.
    try {
      await supabase.from('notifications').insert({
        user_id: profile.id,
        title: 'Complaint Submitted',
        message: `${complaintNo} has been submitted successfully.`,
        type: 'complaint_submitted',
        related_id: complaintId,
        is_read: false,
      });
      const admins = await supabase.from('profiles').select('id').in('role', ['staff', 'admin']);
      if (admins.data && (admins.data as { id: string }[]).length) {
        await supabase.from('notifications').insert((admins.data as { id: string }[]).map((a) => ({
          user_id: a.id,
          title: 'New Complaint Submitted',
          message: `${complaintNo}: ${title.trim()} — ${selectedCat.name}`,
          type: 'new_complaint',
          related_id: complaintId,
          is_read: false,
        })));
      }
    } catch {
      // Complaint is already safely stored.
    }

    setSuccess(`${complaintNo} submitted successfully.`);
    setSubmitting(false);
    setTimeout(onDone, 700);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Raise a Complaint" subtitle="Report a maintenance issue on campus" />

      {error && <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}
      {success && <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="p-5">
          <label htmlFor="category" className="block text-sm font-semibold text-slate-900 mb-2">Category *</label>
          <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            {FIXED_CATEGORIES.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
          <p className="mt-2 text-xs text-slate-500">Tap the field to open the Android category list.</p>
        </Card>

        <Card className="p-5 space-y-4">
          <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Tube light not working in Room 203" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900" /></div>
          <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Description *</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} placeholder="Describe the issue in detail…" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 resize-none" /></div>
        </Card>

        <Card className="p-5">
          <label className="block text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> Location *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Building *</label><input value={building} onChange={(e) => setBuilding(e.target.value)} required placeholder="e.g. Main Block" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900" /></div>
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Floor *</label><input value={floor} onChange={(e) => setFloor(e.target.value)} required inputMode="numeric" placeholder="e.g. 2" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900" /></div>
          </div>
          <div className="mt-3"><label className="text-xs font-medium text-slate-500 mb-1 block">Room / Area *</label><input value={room} onChange={(e) => setRoom(e.target.value)} required placeholder="e.g. Room 203" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900" /></div>
          <div className="mt-3"><label className="text-xs font-medium text-slate-500 mb-1 block">Landmark / Extra details</label><input value={locationDesc} onChange={(e) => setLocationDesc(e.target.value)} placeholder="e.g. Near the window" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900" /></div>
        </Card>

        <Card className="p-5"><label className="block text-sm font-semibold text-slate-900 mb-3">Priority</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">{(['low','medium','high','emergency'] as ComplaintPriority[]).map((p) => { const cfg=PRIORITY_CONFIG[p]; const active=priority===p; return <button key={p} type="button" onClick={() => setPriority(p)} className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${active ? `${cfg.bg} ${cfg.color} border-current` : 'bg-white text-slate-500 border-slate-200'}`}>{cfg.label}</button>; })}</div></Card>

        <Card className="p-5">
          <label className="block text-sm font-semibold text-slate-900 mb-3">Attach Photos <span className="font-normal text-slate-400">(optional, maximum 3)</span></label>
          <div className="flex flex-wrap gap-3">
            {photos.map((photo, idx) => <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200"><img src={photo} alt="Attachment" className="w-full h-full object-cover" /><button type="button" onClick={() => removePhoto(idx)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center"><X className="w-3.5 h-3.5" /></button></div>)}
            {photos.length < 3 && <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-blue-400 bg-slate-50"><Camera className="w-5 h-5 text-slate-400" /><span className="text-[10px] text-slate-500">Add photo</span><input type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={handlePhotoUpload} /></label>}
          </div>
          <p className="text-xs text-slate-400 mt-2">Images are compressed before upload.</p>
        </Card>

        <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 disabled:opacity-60"><Send className="w-4 h-4" />{submitting ? 'Submitting…' : 'Submit Complaint'}</button>
      </form>
    </div>
  );
}

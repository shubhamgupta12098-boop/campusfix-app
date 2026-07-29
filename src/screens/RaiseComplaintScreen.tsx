import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card, Spinner } from '@/components/ui';
import { PRIORITY_CONFIG } from '@/lib/constants';
import type { ComplaintCategory, Building, ComplaintPriority } from '@/lib/supabase';
import { Camera, X, MapPin, Send, AlertCircle } from 'lucide-react';

export function RaiseComplaintScreen({ onDone }: { onDone: () => void }) {
  const { profile } = useAuthStore();
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [floor, setFloor] = useState('');
  const [locationDesc, setLocationDesc] = useState('');
  const [priority, setPriority] = useState<ComplaintPriority>('medium');
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    const [cats, blds] = await Promise.all([
      supabase.from('complaint_categories').select('*').order('name'),
      supabase.from('buildings').select('*').order('name'),
    ]);
    setCategories(cats.data || []);
    setBuildings(blds.data || []);
    setLoading(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: string[] = [];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        newPhotos.push(reader.result as string);
        if (newPhotos.length === files.length) {
          setPhotos((prev) => [...prev, ...newPhotos].slice(0, 5));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !categoryId) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError(null);

    const selectedCat = categories.find((c) => c.id === categoryId);
    const expectedCompletion = new Date();
    expectedCompletion.setHours(expectedCompletion.getHours() + (selectedCat?.sla_hours || 48));

    const { data, error } = await supabase
      .from('complaints')
      .insert({
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        user_id: profile?.id,
        building_id: buildingId || null,
        floor: floor ? parseInt(floor) : null,
        location_description: locationDesc || null,
        priority,
        photo_urls: photos,
        expected_completion: expectedCompletion.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    // Add initial status history
    if (data) {
      await supabase.from('complaint_status_history').insert({
        complaint_id: data.id,
        new_status: 'submitted',
        changed_by: profile?.id,
        remarks: 'Complaint submitted',
      });

      // Create notification for supervisors/admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['supervisor', 'admin']);
      if (admins && admins.length > 0) {
        await supabase.from('notifications').insert(
          admins.map((a) => ({
            user_id: a.id,
            title: 'New Complaint Submitted',
            message: `${title} — ${selectedCat?.name || 'General'}`,
            type: 'new_complaint',
            related_id: data.id,
          }))
        );
      }
    }

    setSubmitting(false);
    onDone();
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Raise a Complaint" subtitle="Report a maintenance issue on campus" />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Category */}
        <Card className="p-5">
          <label className="block text-sm font-semibold text-slate-900 mb-3">Category *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {categories.map((cat) => {
              const active = categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  </div>
                  <span className={`text-xs font-semibold text-center ${active ? 'text-blue-700' : 'text-slate-600'}`}>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Title & Description */}
        <Card className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Tube light not working in Room 203"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              placeholder="Describe the issue in detail…"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 resize-none"
            />
          </div>
        </Card>

        {/* Location */}
        <Card className="p-5">
          <label className="block text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" /> Location
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Building</label>
              <select
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 bg-white"
              >
                <option value="">Select building</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Floor</label>
              <input
                type="number"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="e.g. 2"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Specific location / Room</label>
            <input
              value={locationDesc}
              onChange={(e) => setLocationDesc(e.target.value)}
              placeholder="e.g. Room 203, near window"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900"
            />
          </div>
        </Card>

        {/* Priority */}
        <Card className="p-5">
          <label className="block text-sm font-semibold text-slate-900 mb-3">Priority</label>
          <div className="grid grid-cols-4 gap-2.5">
            {(['low', 'medium', 'high', 'emergency'] as ComplaintPriority[]).map((p) => {
              const cfg = PRIORITY_CONFIG[p];
              const active = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    active ? `${cfg.bg} ${cfg.color} border-current` : `bg-white text-slate-500 border-slate-200 hover:border-slate-300`
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Photos */}
        <Card className="p-5">
          <label className="block text-sm font-semibold text-slate-900 mb-3">Photos (optional, up to 5)</label>
          <div className="flex flex-wrap gap-3">
            {photos.map((url, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 group">
                <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <label className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Camera className="w-5 h-5 text-slate-400" />
                <span className="text-[10px] text-slate-500 font-medium">Add Photo</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}
          </div>
        </Card>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 transition-all disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting…' : 'Submit Complaint'}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

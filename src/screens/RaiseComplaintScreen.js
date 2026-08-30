import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadDataUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { PageHeader, Card } from '@/components/ui';
import { PRIORITY_CONFIG } from '@/lib/constants';
import { Camera, X, MapPin, Send, AlertCircle, Images, Video, PlusCircle } from 'lucide-react';

const FIXED_CATEGORIES = [
    { id: 'electrical', name: 'Electrical', sla_hours: 24 },
    { id: 'plumbing', name: 'Plumbing', sla_hours: 24 },
    { id: 'furniture', name: 'Furniture', sla_hours: 72 },
    { id: 'it-network', name: 'IT / Network', sla_hours: 24 },
    { id: 'cleanliness', name: 'Cleanliness', sla_hours: 12 },
    { id: 'other', name: 'Other', sla_hours: 48 },
];

const MAX_MEDIA = 3;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
});

const readAndCompressImage = (file) => new Promise((resolve, reject) => {
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
            if (!ctx)
                return reject(new Error('Image processing is not supported.'));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.68));
        };
        img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
});

function mediaKind(file) {
    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    if (type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(name))
        return 'image';
    if (type.startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(name))
        return 'video';
    return null;
}

export function RaiseComplaintScreen({ onDone }) {
    const { profile } = useAuthStore();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState('electrical');
    const [building, setBuilding] = useState('');
    const [floor, setFloor] = useState('');
    const [room, setRoom] = useState('');
    const [locationDesc, setLocationDesc] = useState('');
    const [priority, setPriority] = useState('medium');
    const [media, setMedia] = useState([]);
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    const handleMediaUpload = async (event) => {
        const files = Array.from(event.target.files || []).slice(0, MAX_MEDIA - media.length);
        if (!files.length)
            return;
        try {
            const next = [];
            for (const file of files) {
                const kind = mediaKind(file);
                if (!kind)
                    throw new Error('Please choose a photo or supported video file.');
                if (kind === 'image') {
                    if (file.size > 25 * 1024 * 1024)
                        throw new Error('A selected photo is too large. Please choose a photo smaller than 25 MB.');
                    next.push({ kind, name: file.name || 'Photo', dataUrl: await readAndCompressImage(file) });
                }
                else {
                    if (file.size > MAX_VIDEO_BYTES)
                        throw new Error('A selected video is too large. Please choose a video smaller than 20 MB.');
                    next.push({ kind, name: file.name || 'Video', dataUrl: await readFileAsDataUrl(file) });
                }
            }
            setMedia((previous) => [...previous, ...next].slice(0, MAX_MEDIA));
            setError(null);
        }
        catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Could not attach the selected media.');
        }
        finally {
            event.target.value = '';
        }
    };

    const removeMedia = (index) => setMedia((previous) => previous.filter((_, itemIndex) => itemIndex !== index));

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        if (!profile?.id)
            return setError('Please sign in again before submitting a complaint.');
        if (!title.trim() || !description.trim() || !categoryId)
            return setError('Please fill in all required fields.');
        if (!building.trim() || !floor.trim() || !room.trim())
            return setError('Please enter building, floor and room/location.');
        if (media.length < 1)
            return setError('Photo / video evidence is required. Please attach at least one photo or video before submitting.');

        setSubmitting(true);
        const selectedCat = FIXED_CATEGORIES.find((category) => category.id === categoryId);
        const now = new Date();
        const expectedCompletion = new Date(now.getTime() + selectedCat.sla_hours * 60 * 60 * 1000);
        const complaintNo = `CMP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-6)}`;
        const fullLocation = [
            `Building: ${building.trim()}`,
            `Floor: ${floor.trim()}`,
            `Room/Area: ${room.trim()}`,
            locationDesc.trim(),
        ].filter(Boolean).join(' | ');

        let uploadedMedia = [];
        try {
            uploadedMedia = await Promise.all(media.map(async (item, index) => ({
                ...item,
                url: await uploadDataUrl(item.dataUrl, `complaint-${Date.now()}-${index}`),
            })));
        }
        catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'Complaint media could not be saved.');
            setSubmitting(false);
            return;
        }

        const photoUrls = uploadedMedia.filter((item) => item.kind === 'image').map((item) => item.url);
        const videoUrls = uploadedMedia.filter((item) => item.kind === 'video').map((item) => item.url);
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
            photo_urls: photoUrls,
            video_urls: videoUrls,
            media_items: uploadedMedia.map((item) => ({ type: item.kind, url: item.url, name: item.name })),
            escalation_level: 0,
            expected_completion: expectedCompletion.toISOString(),
        }).select('id').single();

        if (result.error || !result.data) {
            setError(result.error?.message || 'Complaint could not be saved. Please try again.');
            setSubmitting(false);
            return;
        }

        const complaintId = result.data.id;
        await supabase.from('complaint_status_history').insert({
            complaint_id: complaintId,
            old_status: null,
            new_status: 'submitted',
            changed_by: profile.id,
            remarks: 'Complaint submitted',
        });

        // A new complaint is visible to ADMIN only. Staff must not receive any
        // alert until an admin has reviewed the complaint as genuine and assigns it.
        try {
            const admins = await supabase.from('profiles').select('id').eq('role', 'admin').eq('is_active', true);
            if (admins.data && admins.data.length) {
                await supabase.from('notifications').insert(admins.data.map((account) => ({
                    user_id: account.id,
                    title: 'New Complaint Submitted',
                    message: `${complaintNo}: ${title.trim()} — ${selectedCat.name}`,
                    type: 'new_complaint',
                    related_id: complaintId,
                    is_read: false,
                })));
            }
        }
        catch {
            // Complaint is already safely stored.
        }

        setSuccess(`${complaintNo} submitted successfully.`);
        setSubmitting(false);
        setTimeout(onDone, 700);
    };

    return (<div className="max-w-3xl mx-auto">
      <PageHeader title="Submit Complaint" subtitle="Report a maintenance issue on campus"/>

      {error && <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0"/>{error}</div>}
      {success && <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="p-5">
          <label htmlFor="category" className="block text-sm font-semibold text-slate-900 mb-2">Category *</label>
          <select id="category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            {FIXED_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </Card>

        <Card className="p-5 space-y-4">
          <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Title *</label><input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 120))} required maxLength={120} placeholder="Enter complaint title" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900"/></div>
          <div><div className="flex items-center justify-between gap-2 mb-1.5"><label className="block text-sm font-semibold text-slate-900">Description *</label><span className="text-xs text-slate-400">{description.length}/500</span></div><textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 500))} required maxLength={500} rows={4} placeholder="Provide details about the issue…" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900 resize-none"/></div>
        </Card>

        <Card className="p-5">
          <label className="block text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600"/> Location *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Building *</label><input value={building} onChange={(event) => setBuilding(event.target.value)} required placeholder="e.g. Main Block" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900"/></div>
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Floor *</label><input value={floor} onChange={(event) => setFloor(event.target.value)} required inputMode="numeric" placeholder="e.g. 2" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900"/></div>
          </div>
          <div className="mt-3"><label className="text-xs font-medium text-slate-500 mb-1 block">Room / Area *</label><input value={room} onChange={(event) => setRoom(event.target.value)} required placeholder="e.g. Room 203" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900"/></div>
          <div className="mt-3"><label className="text-xs font-medium text-slate-500 mb-1 block">Landmark (optional)</label><input value={locationDesc} onChange={(event) => setLocationDesc(event.target.value)} placeholder="e.g. Near entrance, by elevator" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm text-slate-900"/></div>
        </Card>

        <Card className="p-5"><label className="block text-sm font-semibold text-slate-900 mb-3">Priority</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">{['low', 'medium', 'high', 'emergency'].map((item) => { const config = PRIORITY_CONFIG[item]; const active = priority === item; return <button key={item} type="button" onClick={() => setPriority(item)} className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${active ? `${config.bg} ${config.color} border-current` : 'bg-white text-slate-500 border-slate-200'}`}>{config.label}</button>; })}</div></Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1"><Images className="w-5 h-5 text-blue-600"/><label className="text-sm font-semibold text-slate-900">Photo / Video Evidence <span className="text-red-600">*</span></label></div>
          <p className="text-xs text-slate-500 mb-1">At least one photo or video is mandatory. Complaint cannot be submitted without evidence.</p>
          <p className="text-xs font-semibold text-red-600 mb-4">Required * · Maximum {MAX_MEDIA} files</p>

          <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="sr-only" onChange={handleMediaUpload} aria-label="Take photo or video"/>
          <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple className="sr-only" onChange={handleMediaUpload} aria-label="Choose photos or videos from gallery"/>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" disabled={media.length >= MAX_MEDIA} onClick={() => cameraInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><Camera className="w-5 h-5"/>Take Photo / Video</button>
            <button type="button" disabled={media.length >= MAX_MEDIA} onClick={() => galleryInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><Images className="w-5 h-5"/>Choose from Gallery</button>
          </div>

          {media.length > 0 && <div className="grid grid-cols-3 gap-3 mt-4">
            {media.map((item, index) => <div key={`${item.name}-${index}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              {item.kind === 'image'
                ? <img src={item.dataUrl} alt={`Complaint attachment ${index + 1}`} className="w-full h-full object-cover"/>
                : <><video src={item.dataUrl} className="w-full h-full object-cover" preload="metadata"/><span className="absolute left-1.5 bottom-1.5 rounded-md bg-black/65 px-1.5 py-1 text-[9px] font-semibold text-white flex items-center gap-1"><Video className="w-3 h-3"/>Video</span></>}
              <button type="button" onClick={() => removeMedia(index)} className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center" aria-label={`Remove media ${index + 1}`}><X className="w-4 h-4"/></button>
            </div>)}
          </div>}

          {media.length < MAX_MEDIA && media.length > 0 && <button type="button" onClick={() => galleryInputRef.current?.click()} className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-semibold text-blue-600"><PlusCircle className="w-4 h-4"/>Add more</button>}
          <p className="mt-3 text-center text-xs text-slate-400">Photos &amp; videos supported · video max 20 MB · {media.length}/{MAX_MEDIA} selected</p>
        </Card>

        <button type="submit" disabled={submitting || media.length < 1} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"><Send className="w-4 h-4"/>{submitting ? 'Submitting…' : media.length < 1 ? 'Add Photo / Video to Submit' : 'Submit Complaint'}</button>
      </form>
    </div>);
}

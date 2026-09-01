import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadDataUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { Camera, X, MapPin, Send, AlertCircle, Images, Video, PlusCircle, ChevronLeft, Building2, Layers3, DoorOpen } from 'lucide-react';

const FIXED_CATEGORIES = [
    { id: 'electrical', name: 'Electrical', sla_hours: 24 },
    { id: 'plumbing', name: 'Plumbing', sla_hours: 24 },
    { id: 'furniture', name: 'Furniture', sla_hours: 72 },
    { id: 'it-network', name: 'IT / Network', sla_hours: 24 },
    { id: 'cleanliness', name: 'Cleanliness', sla_hours: 12 },
    { id: 'other', name: 'Other', sla_hours: 48 },
];

const MAX_MEDIA = 4;
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

export function RaiseComplaintScreen({ onDone, onBack }) {
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
    const hasPhoto = media.some((item) => item.kind === 'image');
    const hasVideo = media.some((item) => item.kind === 'video');

    const handleMediaUpload = async (event) => {
        const files = Array.from(event.target.files || []).slice(0, MAX_MEDIA);
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
            setMedia((previous) => {
                const combined = [...previous, ...next];
                if (combined.length <= MAX_MEDIA)
                    return combined;
                // If the user filled all slots with videos, always keep a newly selected
                // photo because at least one photo is mandatory for submission.
                const newestPhoto = [...next].reverse().find((item) => item.kind === 'image');
                const newestVideo = [...next].reverse().find((item) => item.kind === 'video');
                if (newestPhoto && !previous.some((item) => item.kind === 'image'))
                    return [...previous.slice(0, MAX_MEDIA - 1), newestPhoto];
                if (newestVideo && !previous.some((item) => item.kind === 'video'))
                    return [...previous.slice(0, MAX_MEDIA - 1), newestVideo];
                return combined.slice(0, MAX_MEDIA);
            });
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
        if (!media.some((item) => item.kind === 'image'))
            return setError('Photo * is required before submitting a complaint.');
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
        if (photoUrls.length < 1) {
            setError('Photo * is required before submitting a complaint.');
            setSubmitting(false);
            return;
        }
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

    return (<div className="student-screen student-submit-screen">
      <div className="student-submit-heading">
        <button type="button" onClick={onBack} className="student-back-button" aria-label="Back"><ChevronLeft size={28}/></button>
        <h1>Submit Complaint</h1>
      </div>

      {error && <div className="student-inline-error"><AlertCircle size={17}/><span>{error}</span></div>}
      {success && <div className="student-success-banner">{success}</div>}

      <form onSubmit={handleSubmit} className="student-submit-form">
        <section className="student-form-card">
          <label htmlFor="category" className="student-field-label"><MapPin size={19}/>Category</label>
          <select id="category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {FIXED_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </section>

        <section className="student-form-card">
          <label className="student-field-label">Title</label>
          <input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 120))} required maxLength={120} placeholder="Enter complaint title"/>
        </section>

        <section className="student-form-card">
          <div className="student-field-label-row"><label className="student-field-label">Description</label><span>{description.length}/500</span></div>
          <textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 500))} required maxLength={500} rows={4} placeholder="Provide details about the issue..."/>
        </section>

        <section className="student-form-card">
          <label className="student-field-label"><MapPin size={19}/>Location</label>
          <div className="student-location-grid">
            <label><Building2 size={25}/><input value={building} onChange={(event) => setBuilding(event.target.value)} required placeholder="Main Block"/></label>
            <label><Layers3 size={25}/><input value={floor} onChange={(event) => setFloor(event.target.value)} required inputMode="numeric" placeholder="Floor 2"/></label>
            <label><DoorOpen size={25}/><input value={room} onChange={(event) => setRoom(event.target.value)} required placeholder="Room 203"/></label>
          </div>
          <label className="student-landmark-label">Landmark (optional)</label>
          <input value={locationDesc} onChange={(event) => setLocationDesc(event.target.value)} placeholder="e.g., near entrance, by elevator"/>
        </section>

        <section className="student-form-card student-priority-card">
          <label className="student-field-label">Priority</label>
          <div className="student-priority-grid">
            {['low', 'medium', 'high', 'emergency'].map((item) => <button key={item} type="button" onClick={() => setPriority(item)} className={`${item} ${priority === item ? 'is-active' : ''}`}>{item === 'low' ? 'Low' : item === 'medium' ? 'Medium' : item === 'high' ? 'High' : 'Emergency'}</button>)}
          </div>
        </section>

        <section className="student-form-card student-media-card">
          <label className="student-field-label"><Images size={19}/>Add Evidence <span>(Photo * + Video optional)</span></label>
          <p>At least one Photo * is mandatory. Video is optional and can also be uploaded.</p>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleMediaUpload}/>
          <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple className="sr-only" onChange={handleMediaUpload}/>
          <div className="student-media-actions">
            <button type="button" disabled={media.length >= MAX_MEDIA && hasPhoto} onClick={() => cameraInputRef.current?.click()}><Camera size={20}/>Take Photo</button>
            <button type="button" disabled={media.length >= MAX_MEDIA} onClick={() => galleryInputRef.current?.click()}><Images size={20}/>Photo / Video</button>
          </div>
          {media.length > 0 && <div className="student-media-preview">{media.map((item, index) => <div key={`${item.name}-${index}`}>
            {item.kind === 'image' ? <img src={item.dataUrl} alt={`Attachment ${index + 1}`}/> : <video src={item.dataUrl} preload="metadata"/>}
            <button type="button" onClick={() => removeMedia(index)} aria-label="Remove attachment"><X size={14}/></button>
          </div>)}</div>}
          {media.length < MAX_MEDIA && media.length > 0 && <button type="button" onClick={() => galleryInputRef.current?.click()} className="student-add-more"><PlusCircle size={16}/>Add more</button>}
          <small>Photo * required • Video optional • Max {MAX_MEDIA} attachments</small>
        </section>

        <button type="submit" disabled={submitting || !hasPhoto} className="student-submit-button"><Send size={22}/>{submitting ? 'Submitting…' : !hasPhoto ? 'Photo * Required' : 'Submit Complaint'}</button>
      </form>
    </div>);
}

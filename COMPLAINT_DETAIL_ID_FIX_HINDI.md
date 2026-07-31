# Complaint Detail ID Fix

MongoDB Atlas ke purane/imported complaint documents me `id` field nahi thi; sirf native `_id` tha. Frontend detail screen `.eq('id', complaintId)` bhej rahi thi, isliye complaint list me dikhne ke bawajood detail page par "Complaint not found" aata tha.

Backend generic data API ab `id` filter ko dono jagah match karti hai:

- MongoDB native `_id`
- Legacy/string `id`

Ye fix GET, UPDATE aur DELETE tino operations par apply hai. Isliye:

- Admin View Full Detail
- Staff complaint detail
- Verify/Assign updates
- Complaint feedback update

native Atlas documents ke saath bhi kaam karenge.

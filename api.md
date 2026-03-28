# Smart Real Estate — API Reference

Base URL: `http://localhost:5000`

---

## Authentication

Protected endpoints require a JWT Bearer token:

```
Authorization: Bearer <token>
```

Obtain a token via [POST /api/auth/login](#post-apiauthlogin).

**Roles**
- `property_admin` — can manage properties. Must have a valid `expiresAt` date to access the API.
- `super_admin` — can manage properties and users. Never expires.

---

## Table of Contents

- [Properties (Public)](#properties-public)
  - [GET /api/properties](#get-apiproperties)
  - [GET /api/properties/featured](#get-apipropertiesfeatured)
  - [GET /api/properties/:id](#get-apipropertiesid)
- [Auth](#auth)
  - [POST /api/auth/login](#post-apiauthlogin)
- [Users (Profile)](#users-profile)
  - [GET /api/users/me](#get-apiusersme)
  - [PUT /api/users/me](#put-apiusersme)
- [Admin — Properties](#admin--properties)
  - [GET /api/admin/properties](#get-apiadminproperties)
  - [POST /api/admin/properties](#post-apiadminproperties)
  - [GET /api/admin/properties/:id](#get-apiadminpropertiesid)
  - [PUT /api/admin/properties/:id](#put-apiadminpropertiesid)
  - [DELETE /api/admin/properties/:id](#delete-apiadminpropertiesid)
- [Admin — Users](#admin--users)
  - [GET /api/admin/users](#get-apiadminusers)
  - [POST /api/admin/users](#post-apiadminusers)
  - [PUT /api/admin/users/:id](#put-apiadminusersid)
  - [DELETE /api/admin/users/:id](#delete-apiadminusersid)
- [Data Shapes](#data-shapes)
- [Error Responses](#error-responses)

---

## Properties (Public)

### GET /api/properties

Returns a paginated list of active properties. Only properties added by currently active and non-expired admins are returned.

**Query Parameters**

- `page` (integer, default `1`) — page number
- `pageSize` (integer, default `10`) — items per page
- `neighborhood` (string) — filter by neighborhood
- `type` (string) — filter by type
- `priceRange` (string) — price range as `min-max`, e.g. `500000-2000000`. Pass `all` to disable.
- `sort` (string, default `newest`) — sort order: `newest` | `price-asc` | `price-desc` | `area-desc`
- `isActive` (string, default `"true"`) — filter by active status: `"true"` | `"false"`

**Response `200`**

```json
{
  "data": [],
  "total": 42,
  "totalActive": 35,
  "totalFeatured": 10,
  "page": 1,
  "pageSize": 10,
  "totalPages": 5
}
```

---

### GET /api/properties/featured

Returns an array of active featured properties (not paginated). Only properties added by currently active and non-expired admins are returned.

**Query Parameters**

- `limit` (integer, default `6`) — maximum number of results

**Response `200`**

```json
[]
```

Array of [Property objects](#property-object).

---

### GET /api/properties/:id

Returns a single property by its ID. Returns `404` if the property belongs to an inactive or expired admin.

**Path Parameters**

- `id` — property MongoDB ObjectId

**Response `200`** — [Property object](#property-object) with an additional `contactPhone` field containing the owner's WhatsApp number.

**Response `404`**

```json
{ "message": "العقار غير موجود" }
```

---

## Auth

### POST /api/auth/login

Authenticates a user and returns a JWT token.

**Request Body** `application/json`

```json
{
  "username": "admin_user",
  "password": "secret123"
}
```

- `username` (string, required)
- `password` (string, required)

**Response `200`**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {}
}
```

`user` is a [User object](#user-object) (no `password` field).

**Response `400`** — validation error (empty fields)

**Response `401`**

```json
{ "message": "اسم المستخدم أو كلمة المرور غير صحيحة" }
```

```json
{ "message": "الحساب غير نشط" }
```

```json
{ "message": "انتهت صلاحية الحساب" }
```

---

## Users (Profile)

### GET /api/users/me

Returns the authenticated user's own profile.

**Auth** — Bearer token required

**Response `200`** — [User object](#user-object) (no `password` field)

**Response `401`** — missing or invalid token

---

### PUT /api/users/me

Updates the authenticated user's own profile. Only `name`, `phone`, and password can be changed. Role, active status, and expiry are admin-only.

**Auth** — Bearer token required

**Request Body** `application/json`

```json
{
  "name": "أحمد علي",
  "phone": "01012345678",
  "currentPassword": "oldpass",
  "newPassword": "newpass123"
}
```

All fields are optional. To change the password, both `currentPassword` and `newPassword` must be provided together.

**Response `200`** — updated [User object](#user-object)

**Response `400`**

```json
{ "message": "كلمة المرور الحالية غير صحيحة" }
```

```json
{ "message": "يجب تقديم كلمة المرور الحالية والجديدة معاً" }
```

**Response `401`** — missing or invalid token

---

## Admin — Properties

All endpoints in this group require a valid Bearer token.

### GET /api/admin/properties

Returns a paginated list of properties.

**Auth** — Bearer token required

- `super_admin` — sees all properties including those whose owner is inactive or expired. Each property includes `ownerSuspended: true` when the owner's account is suspended.
- `property_admin` — sees only properties they created (suspended-owner properties are excluded)

**Query Parameters**

- `page` (integer, default `1`)
- `pageSize` (integer, default `10`)
- `neighborhood` (string)
- `type` (string)
- `priceRange` (string) — e.g. `500000-2000000`
- `sort` (string) — `newest` | `price-asc` | `price-desc` | `area-desc`

**Response `200`** — paginated list. For `super_admin`, each item includes `ownerSuspended: true/false`. For `property_admin`, same shape as [GET /api/properties](#get-apiproperties).

---

### POST /api/admin/properties

Creates a new property. Accepts `multipart/form-data` to support file uploads.

**Auth** — Bearer token required

**Request Body** `multipart/form-data`

Required fields:
- `title` (string, min 1 char)
- `description` (string, min 1 char)
- `price` (number, positive)
- `location` (string)
- `neighborhood` (string)
- `type` (string)

Optional fields:
- `listingType` (string, `"sale"` | `"rent"`, default `"sale"`) — whether the property is listed for sale or rent
- `bedrooms` (integer, min 0)
- `bathrooms` (integer, min 0)
- `area` (number, positive)
- `featured` (`"true"` | `"false"`, default `"false"`)
- `active` (`"true"` | `"false"`, default `"true"`)
- `showPrice` (`"true"` | `"false"`, default `"true"`)
- `amenities` (string) — JSON-encoded array, e.g. `["مسبح","جراج"]`
- `images` (file[]) — one or more image files, uploaded to Cloudinary
- `video` (file) — optional video file, uploaded to Cloudinary

**Response `201`** — [Property object](#property-object)

> `addedBy` is set automatically from the authenticated user's ID — do not include it in the request body.

**Response `400`** — validation error

---

### GET /api/admin/properties/:id

Returns a single property by ID.

**Auth** — Bearer token required

- `super_admin` — can access any property, including those with a suspended owner. Response includes `ownerSuspended` flag.
- `property_admin` — can only access their own properties. Returns `404` if the property belongs to a suspended owner.

**Path Parameters**

- `id` — property MongoDB ObjectId

**Response `200`** — [Property object](#property-object). For `super_admin`, includes `ownerSuspended` flag.

**Response `403`**

```json
{ "message": "غير مصرح: هذا العقار لم يتم إضافته بواسطتك" }
```

**Response `404`**

```json
{ "message": "العقار غير موجود" }
```

---

### PUT /api/admin/properties/:id

Updates an existing property. All fields are optional.

**Auth** — Bearer token required

- `super_admin` — can update any property
- `property_admin` — can only update properties they created

**Path Parameters**

- `id` — property MongoDB ObjectId

**Request Body** `multipart/form-data`

All fields from [POST /api/admin/properties](#post-apiadminproperties) are accepted as optional, plus:

- `existingImages` (string) — JSON-encoded array of existing image URLs to keep. Any URL not listed is deleted from Cloudinary.
- `videoUrl` (string) — pass an empty string `""` to remove the current video.

**Response `200`** — updated [Property object](#property-object)

**Response `400`** — validation error

**Response `403`**

```json
{ "message": "غير مصرح: هذا العقار لم يتم إضافته بواسطتك" }
```

**Response `404`**

```json
{ "message": "العقار غير موجود" }
```

---

### DELETE /api/admin/properties/:id

Deletes a property and removes all associated images and video from Cloudinary.

**Auth** — Bearer token required

- `super_admin` — can delete any property
- `property_admin` — can only delete properties they created

**Path Parameters**

- `id` — property MongoDB ObjectId

**Response `200`**

```json
{ "message": "تم حذف العقار بنجاح" }
```

**Response `403`**

```json
{ "message": "غير مصرح: هذا العقار لم يتم إضافته بواسطتك" }
```

**Response `404`**

```json
{ "message": "العقار غير موجود" }
```

---

## Admin — Users

### GET /api/admin/users

Returns all admin users.

**Auth** — Bearer token required

**Response `200`**

Array of [User objects](#user-object) (no `password` field).

---

### POST /api/admin/users

Creates a new admin user.

**Auth** — Bearer token required (`super_admin` role)

**Request Body** `application/json`

```json
{
  "name": "أحمد علي",
  "username": "ahmed_ali",
  "phone": "01012345678",
  "password": "secret123",
  "role": "property_admin",
  "active": true,
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

Required fields:
- `name` (string, min 2 chars)
- `phone` (string) — valid Egyptian mobile number: `01[0125]XXXXXXXX` or `+201[0125]XXXXXXXX`
- `password` (string, min 6 chars)
- `role` (string) — `super_admin` | `property_admin`

Optional fields:
- `username` (string, min 3 chars, alphanumeric + underscore only)
- `active` (boolean, default `true`)
- `expiresAt` (ISO 8601 date string | `null`) — expiry date for `property_admin` accounts. Required in practice for `property_admin`; ignored and forced to `null` for `super_admin`.

**Response `201`** — [User object](#user-object) (no `password` field)

**Response `400`** — validation error

**Response `403`** — insufficient role

**Response `409`**

```json
{ "message": "اسم المستخدم مستخدم بالفعل" }
```

---

### PUT /api/admin/users/:id

Updates an existing user. All fields are optional.

**Auth** — Bearer token required (`super_admin` role)

**Path Parameters**

- `id` — user MongoDB ObjectId

**Request Body** `application/json`

Same fields as [POST /api/admin/users](#post-apiadminusers), all optional. Use `expiresAt` to renew a `property_admin`'s subscription:

```json
{ "expiresAt": "2026-12-31T23:59:59.000Z" }
```

Pass `null` to make the account permanent (only meaningful if you later change the role to `super_admin`).

**Response `200`** — updated [User object](#user-object)

**Response `404`**

```json
{ "message": "المستخدم غير موجود" }
```

**Response `409`** — duplicate username

---

### DELETE /api/admin/users/:id

Deletes a user. A user cannot delete their own account.

**Auth** — Bearer token required (`super_admin` role)

**Path Parameters**

- `id` — user MongoDB ObjectId

**Response `200`**

```json
{ "message": "تم حذف المستخدم بنجاح" }
```

**Response `403`**

```json
{ "message": "لا يمكنك حذف حسابك الخاص" }
```

**Response `404`**

```json
{ "message": "المستخدم غير موجود" }
```

---

## Data Shapes

### Property Object

```json
{
  "_id": "6650a1b2c3d4e5f6a7b8c9d0",
  "title": "شقة فاخرة في حي الزهراء",
  "description": "شقة واسعة بإطلالة رائعة",
  "price": 1500000,
  "priceFormatted": "١,٥٠٠,٠٠٠ ج.م",
  "showPrice": true,
  "location": "المنيا الجديدة",
  "neighborhood": "حي الزهراء",
  "type": "شقة",
  "listingType": "sale",
  "bedrooms": 3,
  "bathrooms": 2,
  "area": 120,
  "image": "https://res.cloudinary.com/.../img.jpg",
  "images": ["https://res.cloudinary.com/.../img.jpg"],
  "video": null,
  "amenities": ["مسبح", "جراج"],
  "featured": false,
  "active": true,
  "addedBy": "Super Admin",
  "contactPhone": "01012345678",
  "ownerSuspended": false,
  "ownerActive": true,
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

> `_id` — MongoDB ObjectId string.
> `addedBy` — the owner's name.
> `contactPhone` — the owner's WhatsApp number. Present on all property responses. Returned exactly as stored, without normalization.
> `listingType` — `"sale"` or `"rent"`. Defaults to `"sale"` if not provided.
> `bedrooms`, `bathrooms`, `area` — optional; may be absent from the response if not set on the document.
> `priceFormatted` — price formatted with Arabic-Indic digits and ` ج.م` suffix, e.g. `"١,٥٠٠,٠٠٠ ج.م"`.
> `ownerSuspended` — only present in admin responses (`/api/admin/properties`). `true` when the owner's account is inactive or expired.
> `ownerActive` — only present in admin responses (`/api/admin/properties`). `true` when the owner is active.

### User Object

```json
{
  "_id": "6650a1b2c3d4e5f6a7b8c9d0",
  "name": "أحمد علي",
  "username": "ahmed_ali",
  "phone": "01012345678",
  "role": "property_admin",
  "active": true,
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

> `password` is never returned in any response.
> `expiresAt` is `null` for `super_admin` accounts and for `property_admin` accounts with no expiry set.

---

## Error Responses

All errors follow the same shape:

```json
{ "message": "..." }
```

- `400` — validation error, invalid or missing fields
- `401` — unauthenticated, missing or expired token
- `403` — forbidden: insufficient role, self-deletion attempt, or expired account (`انتهت صلاحية الحساب`)
- `404` — resource not found
- `409` — conflict, duplicate username
- `500` — internal server error

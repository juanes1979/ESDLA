# Test Credentials — LOTR 5e RPG

## Maestro (admin global)
- **Email**: `elanillounico_tlotr@proton.me`
- **Password**: `123456`
- **Role**: `maestro`
- **Status**: `aprobado`

## Notes
- Login URL: `/login`
- Register URL: `/register` (new accounts go to `pendiente` status until maestro approves them)
- Approval dashboard: `/admin/users` (maestro only)
- JWT token stored in:
  - `localStorage.lotr5e_token` if "Recordar sesión" is ON (30 days)
  - `sessionStorage.lotr5e_token` if "Recordar sesión" is OFF (cleared on tab close)
- Admin Backup token (legacy): `lotr5e_admin_2026` (env: `ADMIN_BACKUP_TOKEN`)

## API Test Examples
```bash
# Login
curl -X POST $API/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"elanillounico_tlotr@proton.me","password":"123456","remember_me":true}'

# /me (replace TOKEN)
curl $API/api/auth/me -H "Authorization: Bearer TOKEN"

# List users (maestro only)
curl $API/api/auth/users -H "Authorization: Bearer TOKEN"
```

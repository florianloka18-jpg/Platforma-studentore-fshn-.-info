# DIGITAL STUDENT FSHN - Platforma Studentore

Një platformë gjithëpërfshirëse për menaxhimin e jetës studentore në FSHN, e ndërtuar me React, Express dhe Firebase.

## Karakteristikat kryesore

- **Dashboard**: Pasqyra e aktiviteteve dhe statistikave.
- **Klasa**: Menaxhimi i anëtarëve dhe komunikimi.
- **Pjesëmarrja**: Ndjekja e prezencës në kohë reale.
- **Kalendari**: Orari i leksioneve dhe eventeve.
- **Libraria**: Akses në materiale studimore.
- **Teste & Detyra**: Menaxhimi i vlerësimeve.
- **Pyetje Live**: Interaktivitet gjatë leksioneve.
- **Screen Share & Chat**: Bashkëpunim në kohë reale.

## Teknologjitë e përdorura

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide React, Motion.
- **Backend**: Node.js, Express, Socket.io.
- **Database**: SQLite (lokal) / Firebase (auth & config).
- **Autentikimi**: Firebase Auth & JWT.

## Si ta përdorni

### Parakushtet

- Node.js (>= 20.0.0)
- npm

### Instalimi

1. Klononi repozitorin:
   ```bash
   git clone <url-e-repozitorit>
   cd digital-student-fshn
   ```

2. Instaloni varësitë:
   ```bash
   npm install
   ```

3. Konfiguroni mjedisin:
   - Krijoni një skedar `.env` bazuar në `.env.example`.
   - Plotësoni kredencialet e Firebase dhe JWT_SECRET.

### Ekzekutimi

Për zhvillim:
```bash
npm run dev
```

Për prodhim:
```bash
npm run build
npm start
```

## Licenca

Ky projekt është i hapur për përdorim akademik.

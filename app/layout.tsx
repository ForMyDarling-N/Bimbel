
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // --- FUNCTIONS ---
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Fungsi pembantu agar tidak ngetik get panjang-panjang
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isSuperAdmin() {
      return isAuthenticated() && getUserData().role == 'super-admin';
    }
    
    function isAdmin() {
      return isAuthenticated() && getUserData().role in ['super-admin', 'admin'];
    }
    
    function isTutor() {
      return isAuthenticated() && getUserData().role in ['super-admin', 'admin', 'tutor'];
    }

    function isStudent() {
      return isAuthenticated() && getUserData().role == 'student';
    }

    // --- RULES ---

    // USERS
    match /users/{userId} {
      // Biar ga terkena loop rekursif get(), kita cek langsung auth.uid atau field role jika diperlukan
      allow read: if isAuthenticated() && (request.auth.uid == userId || getUserData().role in ['super-admin', 'admin']);
      // Mencegah user baru nge-inject role admin saat daftar
      allow create: if isAuthenticated() && request.auth.uid == userId && request.resource.data.role == 'student';
      // User biasa gak boleh ubah role mereka sendiri jadi admin
      allow update: if isAuthenticated() && (getUserData().role in ['super-admin', 'admin'] || (request.auth.uid == userId && request.resource.data.role == resource.data.role));
      allow delete: if isSuperAdmin();
    }

    // MODULES
    match /modules/{moduleId} {
      allow read: if isAuthenticated();
      allow create: if isTutor();
      allow update: if isTutor() && (isAdmin() || resource.data.authorId == request.auth.uid);
      allow delete: if isAdmin() || (isTutor() && resource.data.authorId == request.auth.uid);
    }

    // EXAMS
    match /exams/{examId} {
      allow read: if isAuthenticated();
      allow create: if isTutor();
      allow update: if isTutor() && (isAdmin() || resource.data.authorId == request.auth.uid);
      allow delete: if isAdmin() || (isTutor() && resource.data.authorId == request.auth.uid);
    }

    // EXAM RESULTS
    match /examResults/{resultId} {
      allow read: if isAuthenticated() && (isAdmin() || request.auth.uid == resource.data.studentId);
      // Diubah ke request.resource.data karena statusnya CREATE
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.studentId;
      allow update: if isTutor() || request.auth.uid == resource.data.studentId;
      allow delete: if isAdmin();
    }

    // TRANSACTIONS
    match /transactions/{transactionId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isSuperAdmin();
    }

    // ARREARS
    match /arrears/{arrearId} {
      allow read: if isAuthenticated() && (isAdmin() || request.auth.uid == resource.data.studentId);
      allow create: if isAdmin() || isStudent();
      allow update: if isAdmin() || (isStudent() && request.auth.uid == resource.data.studentId);
      allow delete: if isAdmin();
    }

    // PAYMENTS
    match /payments/{paymentId} {
      allow read: if isAuthenticated() && (isAdmin() || request.auth.uid == resource.data.studentId);
      allow create: if isAuthenticated();
      allow update: if isAdmin() || (isStudent() && request.auth.uid == resource.data.studentId && resource.data.status == 'pending');
      allow delete: if isAdmin();
    }

    // EVENTS
    match /events/{eventId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isSuperAdmin();
    }

    // CERTIFICATES
    match /certificates/{certificateId} {
      allow read: if isAuthenticated() && (isAdmin() || request.auth.uid == resource.data.studentId);
      // Diubah ke request.resource.data karena statusnya CREATE
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.studentId;
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // GALLERIES
    match /galleries/{galleryId} {
      allow read: if true;
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // BRANCHES
    match /branches/{branchId} {
      allow read: if true;
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isSuperAdmin();
    }
  }
}

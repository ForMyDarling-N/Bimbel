'use client'

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = require('crypto').webcrypto
}
import { useState, useEffect, useRef } from 'react'
import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'your-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'your-auth-domain',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'your-storage-bucket',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'your-sender-id',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'your-app-id',
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)

// --- TYPES ---
type UserRole = 'super-admin' | 'admin' | 'tutor' | 'student'

interface AppUser {
  uid: string
  email: string
  role: UserRole
  name: string
  phone?: string
  photoURL?: string
  createdAt?: Timestamp
}

interface CourseModule {
  id: string
  title: string
  description: string
  videoUrl: string
  audioUrl: string
  textContent: string
  imageUrls: string[]
  links: string[]
  authorId: string
  authorName: string
  createdAt: Timestamp
  updatedAt?: Timestamp
}

interface Question {
  id: string
  type: 'single' | 'multiple' | 'truefalse' | 'matching' | 'ordering' | 'agree' | 'essay'
  text: string
  options?: string[]
  correctAnswers?: string[]
  explanation?: string
  pairs?: { left: string; right: string }[]
  orderItems?: string[]
  score?: number
}

interface Exam {
  id: string
  title: string
  description: string
  questions: Question[]
  duration: number
  price: number
  isPaid: boolean
  branch: string
  authorId: string
  authorName: string
  createdAt: Timestamp
  startDate?: Timestamp
  endDate?: Timestamp
  isActive: boolean
}

interface ExamResult {
  id: string
  examId: string
  studentId: string
  studentName: string
  score: number
  answers: Record<string, any>
  results: Record<string, any>
  submittedAt: Timestamp
  duration: number
  certificateGenerated: boolean
}

interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  branch: string
  date: Timestamp
  description: string
  paymentMethod?: 'cash' | 'transfer' | 'pakkasir'
  status?: 'pending' | 'paid' | 'failed' | 'verified'
  reference?: string
  receiptUrl?: string
}

interface Arrear {
  id: string
  studentName: string
  studentId: string
  amount: number
  dueDate: Timestamp
  branch: string
  paid: boolean
  paymentDate?: Timestamp
  packageType?: 'monthly' | 'meeting' | 'event' | 'package'
  meetingCount?: number
  totalMeetings?: number
  description?: string
  reminderSent?: boolean
  reminderCount?: number
}

interface Payment {
  id: string
  studentId: string
  studentName: string
  amount: number
  method: 'pakkasir' | 'transfer' | 'cash'
  status: 'pending' | 'success' | 'failed' | 'verified'
  proofImage?: string
  pakkasirTransactionId?: string
  pakkasirPaymentUrl?: string
  createdAt: Timestamp
  paidAt?: Timestamp
  verifiedBy?: string
  verifiedAt?: Timestamp
  notes?: string
}

interface Event {
  id: string
  title: string
  description: string
  type: 'tryout' | 'olympiad' | 'workshop' | 'seminar'
  price: number
  branch: string
  startDate: Timestamp
  endDate: Timestamp
  registrationDeadline: Timestamp
  maxParticipants: number
  currentParticipants: number
  status: 'draft' | 'published' | 'closed' | 'completed'
  bannerImage?: string
  authorId: string
  authorName: string
  createdAt: Timestamp
}

interface Certificate {
  id: string
  studentId: string
  studentName: string
  examId?: string
  eventId?: string
  title: string
  score?: number
  template: 'premium' | 'standard' | 'simple'
  certificateUrl: string
  createdAt: Timestamp
  issuedAt: Timestamp
}

interface Gallery {
  id: string
  title: string
  category: 'prestasi' | 'aktivitas' | 'event'
  imageUrl: string
  description: string
  createdAt: Timestamp
  authorId: string
  authorName: string
}

interface Branch {
  id: string
  name: string
  address: string
  phone: string
  manager: string
  createdAt: Timestamp
}

// --- PAKKASIR CONFIG ---
const PAKKASIR_API_KEY = 'tvDwvEkdazd3nQfiPP9vUY7NxDpled47'
const PAKKASIR_SLUG = 'payment-xyber'
const PAKKASIR_BASE_URL = 'https://api.pakkasir.com/v1'

// --- MAIN COMPONENT ---
export default function Home() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [authError, setAuthError] = useState('')

  // Profile state
  const [heroTitle, setHeroTitle] = useState('Bimbel Prestasi')
  const [heroSubtitle, setHeroSubtitle] = useState('Membangun Generasi Cerdas Berprestasi')
  const [heroImage, setHeroImage] = useState('')
  const [programs, setPrograms] = useState([
    { 
      name: 'Kelas Reguler', 
      description: 'Belajar offline di cabang terdekat dengan tutor profesional',
      icon: '🏫',
      price: 'Rp 500.000/bulan'
    },
    { 
      name: 'Kelas Online', 
      description: 'Akses LMS dengan materi lengkap dan video pembelajaran',
      icon: '💻',
      price: 'Rp 350.000/bulan'
    },
    { 
      name: 'Try Out Online', 
      description: 'Simulasi ujian dengan pembahasan mendetail',
      icon: '📝',
      price: 'Rp 150.000/kali'
    },
    { 
      name: 'Lomba Olimpiade', 
      description: 'Kompetisi sains dan matematika tingkat nasional',
      icon: '🏆',
      price: 'Rp 200.000'
    },
  ])
  const [testimonies, setTestimonies] = useState([
    { name: 'Budi Santoso', text: 'Nilai matematika saya meningkat dari 60 menjadi 90 setelah bergabung', rating: 5 },
    { name: 'Siti Rahayu', text: 'Tutor sangat berpengalaman dan metode belajarnya menyenangkan', rating: 5 },
    { name: 'Andi Wijaya', text: 'Saya berhasil lolos olimpiade matematika tingkat provinsi', rating: 5 },
  ])
  const [galleries, setGalleries] = useState<Gallery[]>([])

  // LMS state
  const [modules, setModules] = useState<CourseModule[]>([])
  const [newModule, setNewModule] = useState<Partial<CourseModule>>({
    title: '',
    description: '',
    videoUrl: '',
    audioUrl: '',
    textContent: '',
    imageUrls: [],
    links: []
  })
  const [uploadingModule, setUploadingModule] = useState(false)
  const [moduleImages, setModuleImages] = useState<File[]>([])
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null)

  // Exam state
  const [exams, setExams] = useState<Exam[]>([])
  const [currentExam, setCurrentExam] = useState<Exam | null>(null)
  const [examAnswers, setExamAnswers] = useState<Record<string, any>>({})
  const [examSubmitted, setExamSubmitted] = useState(false)
  const [examScore, setExamScore] = useState(0)
  const [examResults, setExamResults] = useState<Record<string, any>>({})
  const [newExam, setNewExam] = useState<Partial<Exam>>({
    title: '',
    description: '',
    questions: [],
    duration: 60,
    price: 0,
    isPaid: false,
    branch: '',
    isActive: true
  })
  const [examResultsList, setExamResultsList] = useState<ExamResult[]>([])
  const [editingExam, setEditingExam] = useState<Exam | null>(null)

  // Finance state
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [arrears, setArrears] = useState<Arrear[]>([])
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    type: 'income',
    amount: 0,
    category: '',
    branch: '',
    description: '',
    paymentMethod: 'cash',
    status: 'paid'
  })
  const [newArrear, setNewArrear] = useState<Partial<Arrear>>({
    studentName: '',
    amount: 0,
    branch: '',
    packageType: 'monthly',
    meetingCount: 0,
    totalMeetings: 10
  })
  const [filterPeriod, setFilterPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [filterDate, setFilterDate] = useState(new Date())
  const [selectedBranch, setSelectedBranch] = useState('all')

  // Payment state
  const [payments, setPayments] = useState<Payment[]>([])
  const [isPakkasirActive, setIsPakkasirActive] = useState(true)
  const [bankTransferFile, setBankTransferFile] = useState<File | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentStudent, setPaymentStudent] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [pakkasirUrl, setPakkasirUrl] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')

  // Event state
  const [events, setEvents] = useState<Event[]>([])
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: '',
    description: '',
    type: 'tryout',
    price: 0,
    branch: '',
    status: 'draft',
    maxParticipants: 100,
    currentParticipants: 0
  })
  const [eventBanner, setEventBanner] = useState<File | null>(null)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)

  // Certificate state
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [certificateTemplate, setCertificateTemplate] = useState<'premium' | 'standard' | 'simple'>('premium')
  const [certificateStudent, setCertificateStudent] = useState('')
  const [certificateTitle, setCertificateTitle] = useState('')
  const [certificateScore, setCertificateScore] = useState('')
  const [generatingCertificate, setGeneratingCertificate] = useState(false)

  // Branch state
  const [branches, setBranches] = useState<Branch[]>([])
  const [newBranch, setNewBranch] = useState<Partial<Branch>>({
    name: '',
    address: '',
    phone: '',
    manager: ''
  })

  // Notification state
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationPhone, setNotificationPhone] = useState('')
  const [sendingNotification, setSendingNotification] = useState(false)

  // --- DATA LOADING ---
  useEffect(() => {
    if (!user) return

    // Load modules
    const unsubscribeModules = onSnapshot(
      query(collection(db, 'modules'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CourseModule[]
        setModules(data)
      }
    )

    // Load exams
    const unsubscribeExams = onSnapshot(
      query(collection(db, 'exams'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Exam[]
        setExams(data)
      }
    )

    // Load transactions
    const unsubscribeTransactions = onSnapshot(
      query(collection(db, 'transactions'), orderBy('date', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Transaction[]
        setTransactions(data)
      }
    )

    // Load arrears
    const unsubscribeArrears = onSnapshot(
      query(collection(db, 'arrears'), orderBy('dueDate', 'asc')),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Arrear[]
        setArrears(data)
      }
    )

    // Load payments
    const unsubscribePayments = onSnapshot(
      query(collection(db, 'payments'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Payment[]
        setPayments(data)
      }
    )

    // Load events
    const unsubscribeEvents = onSnapshot(
      query(collection(db, 'events'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Event[]
        setEvents(data)
      }
    )

    // Load certificates
    const unsubscribeCertificates = onSnapshot(
      query(collection(db, 'certificates'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Certificate[]
        setCertificates(data)
      }
    )

    // Load galleries
    const unsubscribeGalleries = onSnapshot(
      query(collection(db, 'galleries'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Gallery[]
        setGalleries(data)
      }
    )

    // Load branches
    const unsubscribeBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Branch[]
      setBranches(data)
    })

    // Load exam results for student
    if (user?.role === 'student') {
      const unsubscribeResults = onSnapshot(
        query(collection(db, 'examResults'), where('studentId', '==', user.uid)),
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ExamResult[]
          setExamResultsList(data)
        }
      )
      return () => unsubscribeResults()
    }

    return () => {
      unsubscribeModules()
      unsubscribeExams()
      unsubscribeTransactions()
      unsubscribeArrears()
      unsubscribePayments()
      unsubscribeEvents()
      unsubscribeCertificates()
      unsubscribeGalleries()
      unsubscribeBranches()
    }
  }, [user])

  // --- AUTH ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (userDoc.exists()) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            ...userDoc.data(),
          } as AppUser)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, email, password)
        const userDoc = await getDoc(doc(db, 'users', cred.user.uid))
        if (userDoc.exists()) {
          setUser({
            uid: cred.user.uid,
            email: cred.user.email || '',
            ...userDoc.data(),
          } as AppUser)
        }
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: cred.user.email,
          name: name || 'User',
          phone: phone || '',
          role: 'student',
          createdAt: Timestamp.now(),
        })
        setUser({
          uid: cred.user.uid,
          email: cred.user.email || '',
          name: name || 'User',
          phone: phone || '',
          role: 'student',
        })
      }
    } catch (error: any) {
      setAuthError(error.message)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    setUser(null)
  }

  // --- LMS FUNCTIONS ---
  const addModule = async () => {
    if (!newModule.title || !user) return
    setUploadingModule(true)
    try {
      const imageUrls: string[] = []
      for (const file of moduleImages) {
        const path = `modules/${Date.now()}_${file.name}`
        const url = await uploadFile(file, path)
        imageUrls.push(url)
      }

      const moduleData = {
        ...newModule,
        imageUrls,
        authorId: user.uid,
        authorName: user.name,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }

      const docRef = await addDoc(collection(db, 'modules'), moduleData)
      setModules([{ id: docRef.id, ...moduleData } as CourseModule, ...modules])
      setNewModule({ title: '', description: '', videoUrl: '', audioUrl: '', textContent: '', links: [], imageUrls: [] })
      setModuleImages([])
      alert('Modul berhasil ditambahkan!')
    } catch (error) {
      console.error('Error adding module:', error)
      alert('Gagal menambahkan modul')
    }
    setUploadingModule(false)
  }

  const updateModule = async () => {
    if (!editingModule || !user) return
    setUploadingModule(true)
    try {
      const imageUrls = editingModule.imageUrls || []
      for (const file of moduleImages) {
        const path = `modules/${Date.now()}_${file.name}`
        const url = await uploadFile(file, path)
        imageUrls.push(url)
      }

      const updatedData = {
        ...editingModule,
        imageUrls,
        updatedAt: Timestamp.now(),
      }

      await updateDoc(doc(db, 'modules', editingModule.id), updatedData)
      setModules(modules.map(m => m.id === editingModule.id ? { ...updatedData, id: m.id } as CourseModule : m))
      setEditingModule(null)
      setModuleImages([])
      alert('Modul berhasil diupdate!')
    } catch (error) {
      console.error('Error updating module:', error)
      alert('Gagal mengupdate modul')
    }
    setUploadingModule(false)
  }

  const deleteModule = async (moduleId: string) => {
    if (!confirm('Yakin ingin menghapus modul ini?')) return
    try {
      await deleteDoc(doc(db, 'modules', moduleId))
      setModules(modules.filter(m => m.id !== moduleId))
      alert('Modul berhasil dihapus!')
    } catch (error) {
      console.error('Error deleting module:', error)
      alert('Gagal menghapus modul')
    }
  }

  const uploadFile = async (file: File, path: string) => {
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    return await getDownloadURL(storageRef)
  }

  // --- EXAM FUNCTIONS ---
  const addExam = async () => {
    if (!newExam.title || !newExam.questions?.length || !user) return
    try {
      const examData = {
        ...newExam,
        authorId: user.uid,
        authorName: user.name,
        createdAt: Timestamp.now(),
        isActive: true,
      }
      const docRef = await addDoc(collection(db, 'exams'), examData)
      setExams([{ id: docRef.id, ...examData } as Exam, ...exams])
      setNewExam({ title: '', description: '', questions: [], duration: 60, price: 0, isPaid: false, branch: '', isActive: true })
      alert('Ujian berhasil ditambahkan!')
    } catch (error) {
      console.error('Error adding exam:', error)
      alert('Gagal menambahkan ujian')
    }
  }

  const addQuestion = () => {
    if (!newExam.questions) newExam.questions = []
    newExam.questions.push({
      id: `q${Date.now()}`,
      type: 'single',
      text: '',
      options: ['', '', '', ''],
      correctAnswers: [],
      explanation: '',
    })
    setNewExam({ ...newExam })
  }

  const removeQuestion = (index: number) => {
    if (!newExam.questions) return
    newExam.questions.splice(index, 1)
    setNewExam({ ...newExam })
  }

  const updateQuestion = (index: number, field: string, value: any) => {
    if (!newExam.questions) return
    newExam.questions[index] = { ...newExam.questions[index], [field]: value }
    setNewExam({ ...newExam })
  }

  const handleExamSubmit = async () => {
    if (!currentExam || !user) return
    let correct = 0
    const results: Record<string, any> = {}
    
    currentExam.questions.forEach((q) => {
      const userAnswer = examAnswers[q.id]
      let isCorrect = false
      
      if (!userAnswer) {
        results[q.id] = { correct: false, userAnswer: 'Tidak dijawab' }
        return
      }

      if (q.type === 'single' && userAnswer === q.correctAnswers?.[0]) {
        isCorrect = true
      } else if (q.type === 'multiple') {
        const userArr = Array.isArray(userAnswer) ? userAnswer : [userAnswer]
        const correctArr = q.correctAnswers || []
        if (userArr.length === correctArr.length && userArr.every((a: string) => correctArr.includes(a))) {
          isCorrect = true
        }
      } else if (q.type === 'truefalse' && userAnswer === q.correctAnswers?.[0]) {
        isCorrect = true
      } else if (q.type === 'matching') {
        const userPairs = userAnswer as Record<string, string>
        const correctPairs = q.pairs || []
        let match = true
        correctPairs.forEach((p) => {
          if (userPairs[p.left] !== p.right) match = false
        })
        if (match) isCorrect = true
      } else if (q.type === 'ordering') {
        const userOrder = userAnswer as string[]
        const correctOrder = q.orderItems || []
        if (userOrder.length === correctOrder.length && userOrder.every((item, i) => item === correctOrder[i])) {
          isCorrect = true
        }
      } else if (q.type === 'agree' && userAnswer === q.correctAnswers?.[0]) {
        isCorrect = true
      }
      
      if (isCorrect) correct++
      results[q.id] = { 
        correct: isCorrect, 
        userAnswer, 
        correctAnswer: q.correctAnswers,
        explanation: q.explanation 
      }
    })

    const totalQuestions = currentExam.questions.length
    const score = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0
    
    setExamScore(score)
    setExamResults(results)
    setExamSubmitted(true)

    // Save result
    try {
      await addDoc(collection(db, 'examResults'), {
        examId: currentExam.id,
        studentId: user.uid,
        studentName: user.name,
        score,
        answers: examAnswers,
        results,
        submittedAt: Timestamp.now(),
        duration: currentExam.duration,
        certificateGenerated: false,
      })
    } catch (error) {
      console.error('Error saving result:', error)
    }
  }

  // --- FINANCE FUNCTIONS ---
  const addTransaction = async () => {
    if (!newTransaction.amount || !newTransaction.type || !user) return
    try {
      const transactionData = {
        ...newTransaction,
        date: Timestamp.now(),
        status: 'paid',
      }
      const docRef = await addDoc(collection(db, 'transactions'), transactionData)
      setTransactions([{ id: docRef.id, ...transactionData } as Transaction, ...transactions])
      setNewTransaction({ type: 'income', amount: 0, category: '', branch: '', description: '', paymentMethod: 'cash', status: 'paid' })
      alert('Transaksi berhasil ditambahkan!')
    } catch (error) {
      console.error('Error adding transaction:', error)
      alert('Gagal menambahkan transaksi')
    }
  }

  const addArrear = async () => {
    if (!newArrear.studentName || !newArrear.amount || !user) return
    try {
      const arrearData = {
        ...newArrear,
        paid: false,
        createdAt: Timestamp.now(),
        reminderSent: false,
        reminderCount: 0,
      }
      const docRef = await addDoc(collection(db, 'arrears'), arrearData)
      setArrears([{ id: docRef.id, ...arrearData } as Arrear, ...arrears])
      setNewArrear({ studentName: '', amount: 0, branch: '', packageType: 'monthly', meetingCount: 0, totalMeetings: 10 })
      alert('Tunggakan berhasil ditambahkan!')
    } catch (error) {
      console.error('Error adding arrear:', error)
      alert('Gagal menambahkan tunggakan')
    }
  }

  const payArrear = async (arrearId: string) => {
    try {
      await updateDoc(doc(db, 'arrears', arrearId), {
        paid: true,
        paymentDate: Timestamp.now(),
      })
      setArrears(arrears.map(a => a.id === arrearId ? { ...a, paid: true, paymentDate: Timestamp.now() } : a))
      alert('Pembayaran tunggakan berhasil!')
    } catch (error) {
      console.error('Error paying arrear:', error)
      alert('Gagal membayar tunggakan')
    }
  }

  const getFilteredTransactions = () => {
    let filtered = transactions
    if (selectedBranch !== 'all') {
      filtered = filtered.filter(t => t.branch === selectedBranch)
    }

    const now = filterDate
    let startDate = new Date()
    let endDate = new Date()
    
    switch(filterPeriod) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 1)
        break
      case 'weekly':
        const day = now.getDay()
        startDate = new Date(now)
        startDate.setDate(now.getDate() - day)
        startDate.setHours(0,0,0,0)
        endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 7)
        break
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        break
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1)
        endDate = new Date(now.getFullYear() + 1, 0, 1)
        break
    }
    
    return filtered.filter(t => {
      const tDate = t.date?.toDate?.()
      if (!tDate) return false
      return tDate >= startDate && tDate < endDate
    })
  }

  // --- PAYMENT FUNCTIONS ---
  const createPakkasirPayment = async () => {
    if (!paymentAmount || !paymentStudent || !user) {
      alert('Mohon isi jumlah dan nama siswa')
      return
    }

    setPaymentLoading(true)
    try {
      const response = await fetch(`${PAKKASIR_BASE_URL}/${PAKKASIR_SLUG}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PAKKASIR_API_KEY}`,
        },
        body: JSON.stringify({
          amount: parseInt(paymentAmount),
          customerName: paymentStudent,
          customerEmail: user.email || '',
          customerPhone: user.phone || '',
          description: `Pembayaran Bimbel - ${paymentStudent}`,
          redirectUrl: window.location.origin + '/payment/callback',
          webhookUrl: window.location.origin + '/api/payment-webhook',
          metadata: {
            studentId: user.uid,
            branch: user?.role === 'admin' ? 'admin' : 'online'
          }
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        const paymentData = {
          studentId: user.uid,
          studentName: paymentStudent,
          amount: parseInt(paymentAmount),
          method: 'pakkasir' as const,
          status: 'pending' as const,
          pakkasirTransactionId: data.transactionId,
          pakkasirPaymentUrl: data.paymentUrl,
          createdAt: Timestamp.now(),
          notes: paymentNotes,
        }
        
        const docRef = await addDoc(collection(db, 'payments'), paymentData)
        setPayments([{ id: docRef.id, ...paymentData } as Payment, ...payments])
        setPakkasirUrl(data.paymentUrl)
        
        // Open payment window
        window.open(data.paymentUrl, '_blank')
        alert('Pembayaran berhasil dibuat! Silakan selesaikan pembayaran di halaman Pakkasir.')
        
        // Reset form
        setPaymentAmount('')
        setPaymentStudent('')
        setPaymentNotes('')
      } else {
        alert('Gagal membuat pembayaran: ' + data.message)
      }
    } catch (error) {
      console.error('Error creating payment:', error)
      alert('Gagal terhubung ke Pakkasir. Silakan coba lagi.')
    }
    setPaymentLoading(false)
  }

  const handleBankTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bankTransferFile || !paymentAmount || !paymentStudent || !user) {
      alert('Mohon lengkapi semua data')
      return
    }

    setPaymentLoading(true)
    try {
      // Upload proof image
      const filePath = `payments/${Date.now()}_${bankTransferFile.name}`
      const downloadUrl = await uploadFile(bankTransferFile, filePath)

      const paymentData = {
        studentId: user.uid,
        studentName: paymentStudent,
        amount: parseInt(paymentAmount),
        method: 'transfer' as const,
        status: 'pending' as const,
        proofImage: downloadUrl,
        createdAt: Timestamp.now(),
        notes: paymentNotes,
      }

      const docRef = await addDoc(collection(db, 'payments'), paymentData)
      setPayments([{ id: docRef.id, ...paymentData } as Payment, ...payments])

      alert('Bukti transfer berhasil diupload! Menunggu verifikasi admin.')
      setBankTransferFile(null)
      setPaymentAmount('')
      setPaymentStudent('')
      setPaymentNotes('')
      
      // Add to arrears
      await addDoc(collection(db, 'arrears'), {
        studentName: paymentStudent,
        studentId: user.uid,
        amount: parseInt(paymentAmount),
        dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        branch: 'Online',
        paid: false,
        createdAt: Timestamp.now(),
        description: 'Menunggu verifikasi pembayaran'
      })
    } catch (error) {
      console.error('Error uploading proof:', error)
      alert('Gagal upload bukti transfer')
    }
    setPaymentLoading(false)
  }

  const verifyPayment = async (paymentId: string) => {
    try {
      await updateDoc(doc(db, 'payments', paymentId), {
        status: 'verified',
        verifiedBy: user?.name || 'admin',
        verifiedAt: Timestamp.now(),
      })
      setPayments(payments.map(p => p.id === paymentId ? { ...p, status: 'verified' } : p))
      alert('Pembayaran berhasil diverifikasi!')
    } catch (error) {
      console.error('Error verifying payment:', error)
      alert('Gagal verifikasi pembayaran')
    }
  }

  // --- EVENT FUNCTIONS ---
  const addEvent = async () => {
    if (!newEvent.title || !newEvent.description || !user) return
    try {
      let bannerImage = ''
      if (eventBanner) {
        bannerImage = await uploadFile(eventBanner, `events/${Date.now()}_${eventBanner.name}`)
      }

      const eventData = {
        ...newEvent,
        bannerImage,
        currentParticipants: 0,
        authorId: user.uid,
        authorName: user.name,
        createdAt: Timestamp.now(),
        status: newEvent.status || 'draft',
      }

      const docRef = await addDoc(collection(db, 'events'), eventData)
      setEvents([{ id: docRef.id, ...eventData } as Event, ...events])
      setNewEvent({ title: '', description: '', type: 'tryout', price: 0, branch: '', status: 'draft', maxParticipants: 100, currentParticipants: 0 })
      setEventBanner(null)
      alert('Event berhasil ditambahkan!')
    } catch (error) {
      console.error('Error adding event:', error)
      alert('Gagal menambahkan event')
    }
  }

  const publishEvent = async (eventId: string) => {
    try {
      await updateDoc(doc(db, 'events', eventId), {
        status: 'published',
      })
      setEvents(events.map(e => e.id === eventId ? { ...e, status: 'published' } : e))
      alert('Event berhasil dipublikasikan!')
    } catch (error) {
      console.error('Error publishing event:', error)
      alert('Gagal mempublikasikan event')
    }
  }

  // --- CERTIFICATE FUNCTIONS ---
  const generateCertificate = async () => {
    if (!certificateStudent || !certificateTitle || !user) {
      alert('Mohon isi semua data sertifikat')
      return
    }

    setGeneratingCertificate(true)
    try {
      const certElement = document.createElement('div')
      certElement.style.cssText = `
        width: 800px;
        height: 600px;
        padding: 40px;
        background: linear-gradient(135deg, #1e3a8a 0%, #1a365d 100%);
        color: white;
        font-family: Arial, sans-serif;
        position: relative;
        overflow: hidden;
      `

      certElement.innerHTML = `
        <div style="
          position: absolute;
          top: 20px;
          left: 20px;
          right: 20px;
          bottom: 20px;
          border: 3px solid #facc15;
          border-radius: 20px;
          padding: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.05);
        ">
          <div style="position: absolute; top: 30px; right: 30px; font-size: 12px; color: #facc15; opacity: 0.3;">
            CERT-${Date.now()}
          </div>
          
          <div style="
            width: 80px;
            height: 80px;
            background: #facc15;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
          ">
            <span style="font-size: 40px; color: #1e3a8a; font-weight: bold;">BP</span>
          </div>
          
          <h1 style="
            font-size: 48px;
            font-weight: bold;
            color: #facc15;
            margin-bottom: 10px;
            letter-spacing: 4px;
          ">SERTIFIKAT</h1>
          
          <p style="font-size: 18px; color: #e2e8f0; margin-bottom: 10px;">
            Diberikan kepada
          </p>
          
          <h2 style="
            font-size: 36px;
            font-weight: bold;
            color: white;
            margin: 10px 0;
            border-bottom: 2px solid #facc15;
            padding-bottom: 10px;
          ">${certificateStudent}</h2>
          
          <p style="font-size: 18px; color: #e2e8f0; margin-top: 10px;">
            Telah menyelesaikan
          </p>
          
          <h3 style="
            font-size: 28px;
            font-weight: bold;
            color: #facc15;
            margin: 10px 0;
          ">${certificateTitle}</h3>
          
          ${certificateScore ? `
            <div style="
              background: #facc15;
              color: #1e3a8a;
              padding: 8px 20px;
              border-radius: 20px;
              font-weight: bold;
              font-size: 20px;
              margin: 10px 0;
            ">
              Nilai: ${certificateScore}%
            </div>
          ` : ''}
          
          <div style="
            margin-top: 20px;
            display: flex;
            gap: 40px;
            color: #e2e8f0;
            font-size: 14px;
          ">
            <div style="text-align: center;">
              <div style="width: 100px; border-top: 2px solid #facc15; margin-bottom: 5px;"></div>
              <p>Kepala Bimbel</p>
            </div>
            <div style="text-align: center;">
              <div style="width: 100px; border-top: 2px solid #facc15; margin-bottom: 5px;"></div>
              <p>Tanggal: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      `

      document.body.appendChild(certElement)
      
      const canvas = await html2canvas(certElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#1e3a8a',
      })
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('landscape', 'mm', 'a4')
      pdf.addImage(imgData, 'PNG', 0, 0, 297, 210)
      const pdfBlob = pdf.output('blob')
      
      // Upload to Firebase Storage
      const pdfFile = new File([pdfBlob], `certificate_${Date.now()}.pdf`, { type: 'application/pdf' })
      const pdfPath = `certificates/${Date.now()}_${certificateStudent}.pdf`
      const pdfUrl = await uploadFile(pdfFile, pdfPath)
      
      // Save to Firestore
      await addDoc(collection(db, 'certificates'), {
        studentId: user.uid,
        studentName: certificateStudent,
        title: certificateTitle,
        score: certificateScore ? parseInt(certificateScore) : undefined,
        template: certificateTemplate,
        certificateUrl: pdfUrl,
        createdAt: Timestamp.now(),
        issuedAt: Timestamp.now(),
      })
      
      // Download PDF
      pdf.save(`sertifikat_${certificateStudent}.pdf`)
      
      document.body.removeChild(certElement)
      alert('Sertifikat berhasil dibuat dan disimpan!')
      
      // Reset form
      setCertificateStudent('')
      setCertificateTitle('')
      setCertificateScore('')
    } catch (error) {
      console.error('Error generating certificate:', error)
      alert('Gagal membuat sertifikat')
    }
    setGeneratingCertificate(false)
  }

  // --- GALLERY FUNCTIONS ---
  const addGallery = async (file: File, title: string, category: 'prestasi' | 'aktivitas' | 'event', description: string) => {
    if (!user) return
    try {
      const imageUrl = await uploadFile(file, `gallery/${Date.now()}_${file.name}`)
      const galleryData = {
        title,
        category,
        imageUrl,
        description,
        authorId: user.uid,
        authorName: user.name,
        createdAt: Timestamp.now(),
      }
      const docRef = await addDoc(collection(db, 'galleries'), galleryData)
      setGalleries([{ id: docRef.id, ...galleryData } as Gallery, ...galleries])
      alert('Gambar berhasil ditambahkan ke galeri!')
    } catch (error) {
      console.error('Error adding gallery:', error)
      alert('Gagal menambahkan gambar ke galeri')
    }
  }

  // --- WHATSAPP FUNCTIONS ---
  const sendWhatsAppNotification = async (phone: string, message: string) => {
    if (!phone || !message) {
      alert('Mohon isi nomor telepon dan pesan')
      return
    }

    setSendingNotification(true)
    try {
      // Mock implementation - replace with actual WhatsApp API
      const formattedPhone = phone.startsWith('0') ? `62${phone.substring(1)}` : phone
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      console.log(`WhatsApp terkirim ke ${formattedPhone}: ${message}`)
      alert(`Notifikasi WhatsApp berhasil terkirim ke ${phone}`)
      
      // Update reminder sent
      setNotificationMessage('')
      setNotificationPhone('')
    } catch (error) {
      console.error('Error sending WhatsApp:', error)
      alert('Gagal mengirim notifikasi WhatsApp')
    }
    setSendingNotification(false)
  }

  const sendArrearReminders = async () => {
    const overdueArrears = arrears.filter(a => !a.paid && a.dueDate.toDate() < new Date())
    if (overdueArrears.length === 0) {
      alert('Tidak ada tunggakan yang jatuh tempo')
      return
    }

    setSendingNotification(true)
    try {
      for (const arrear of overdueArrears) {
        const message = `Pengingat: Tunggakan pembayaran Bimbel atas nama ${arrear.studentName} sebesar Rp ${arrear.amount.toLocaleString()} sudah jatuh tempo. Segera lakukan pembayaran.`
        // Send to student's phone (mock)
        await sendWhatsAppNotification('08123456789', message)
        
        // Update reminder
        await updateDoc(doc(db, 'arrears', arrear.id), {
          reminderSent: true,
          reminderCount: (arrear.reminderCount || 0) + 1,
        })
      }
      alert(`Pengingat tunggakan terkirim untuk ${overdueArrears.length} siswa`)
    } catch (error) {
      console.error('Error sending reminders:', error)
      alert('Gagal mengirim pengingat')
    }
    setSendingNotification(false)
  }

  // --- BRANCH FUNCTIONS ---
  const addBranch = async () => {
    if (!newBranch.name || !user) return
    try {
      const branchData = {
        ...newBranch,
        createdAt: Timestamp.now(),
      }
      const docRef = await addDoc(collection(db, 'branches'), branchData)
      setBranches([{ id: docRef.id, ...branchData } as Branch, ...branches])
      setNewBranch({ name: '', address: '', phone: '', manager: '' })
      alert('Cabang berhasil ditambahkan!')
    } catch (error) {
      console.error('Error adding branch:', error)
      alert('Gagal menambahkan cabang')
    }
  }

  // --- RENDER FUNCTIONS ---
  const renderAuth = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy via-navy/90 to-navy/70 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-navy rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-3xl font-bold">BP</span>
          </div>
          <h1 className="text-2xl font-bold text-navy">Bimbel Prestasi</h1>
          <p className="text-gray-600 mt-1">Sistem Bimbingan Belajar Online</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-navy focus:border-transparent transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="masukkan@email.com"
              required
            />
          </div>

          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-navy focus:border-transparent transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama lengkap"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
                <input
                  type="tel"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-navy focus:border-transparent transition-all"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-navy focus:border-transparent transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
            />
          </div>

          {authError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
              {authError}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-navy text-white py-3 rounded-lg font-semibold hover:bg-navy/90 transition-colors"
          >
            {isLogin ? 'Masuk' : 'Daftar'}
          </button>

          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="w-full text-sm text-gray-600 hover:text-navy transition-colors"
          >
            {isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
          </button>
        </form>
      </div>
    </div>
  )

  const renderDashboard = () => {
    if (!user) return null

    const tabs = [
      { id: 'profile', label: 'Beranda', icon: '🏠' },
      { id: 'lms', label: 'LMS', icon: '📚' },
      { id: 'exam', label: 'Ujian', icon: '📝' },
      { id: 'finance', label: 'Keuangan', icon: '💰' },
      { id: 'payment', label: 'Pembayaran', icon: '💳' },
      { id: 'event', label: 'Event', icon: '🎯' },
      { id: 'certificate', label: 'Sertifikat', icon: '📜' },
      { id: 'gallery', label: 'Galeri', icon: '🖼️' },
    ]

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-navy text-white shadow-lg sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex flex-wrap justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-yellow rounded-lg flex items-center justify-center shadow-md">
                <span className="text-navy font-bold text-lg">BP</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Bimbel Prestasi</h1>
                <p className="text-xs text-yellow/80 hidden sm:block">Sistem Bimbingan Belajar</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm hidden md:inline">
                {user.name} ({user.role})
              </span>
              <button
                onClick={handleLogout}
                className="bg-yellow text-navy px-4 py-2 rounded-lg font-semibold hover:bg-yellow/90 transition-colors text-sm"
              >
                Keluar
              </button>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white shadow-md overflow-x-auto sticky top-[73px] z-40">
          <div className="container mx-auto px-4">
            <ul className="flex space-x-1 py-2">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'bg-navy text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'lms' && renderLMS()}
          {activeTab === 'exam' && renderExam()}
          {activeTab === 'finance' && renderFinance()}
          {activeTab === 'payment' && renderPayment()}
          {activeTab === 'event' && renderEvent()}
          {activeTab === 'certificate' && renderCertificate()}
          {activeTab === 'gallery' && renderGallery()}
        </main>

        {/* Footer */}
        <footer className="bg-navy text-white mt-12">
          <div className="container mx-auto px-4 py-6 text-center text-sm">
            <p>&copy; 2024 Bimbel Prestasi. All rights reserved.</p>
            <p className="text-yellow/60 mt-1">Membangun Generasi Cerdas Berprestasi</p>
          </div>
        </footer>
      </div>
    )
  }

  // --- PROFILE TAB ---
  const renderProfile = () => (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-navy to-navy/80 text-white rounded-2xl p-8 md:p-12 shadow-xl">
        <div className="max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">{heroTitle}</h2>
          <p className="text-xl md:text-2xl mb-6 text-yellow/90">{heroSubtitle}</p>
          <div className="flex flex-wrap gap-4">
            <button className="bg-yellow text-navy px-8 py-3 rounded-lg font-semibold hover:bg-yellow/90 transition-colors shadow-lg">
              Daftar Sekarang
            </button>
            <button className="border-2 border-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors">
              Lihat Program
            </button>
          </div>
        </div>
      </section>

      {/* Programs */}
      <section>
        <h3 className="text-2xl font-bold text-navy mb-6 flex items-center">
          <span className="w-1 h-10 bg-yellow mr-3"></span>
          Program Bimbel
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {programs.map((p, i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow border-t-4 border-yellow">
              <div className="text-4xl mb-3">{p.icon}</div>
              <h4 className="text-xl font-semibold text-navy">{p.name}</h4>
              <p className="text-gray-600 mt-2 text-sm">{p.description}</p>
              <p className="text-navy font-bold mt-3">{p.price}</p>
              <button className="mt-4 text-navy font-semibold hover:text-yellow transition-colors text-sm">
                Lihat Detail →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonies */}
      <section>
        <h3 className="text-2xl font-bold text-navy mb-6 flex items-center">
          <span className="w-1 h-10 bg-yellow mr-3"></span>
          Testimoni
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonies.map((t, i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center space-x-4 mb-3">
                <div className="w-12 h-12 bg-navy rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-navy">{t.name}</p>
                  <div className="flex text-yellow text-sm">
                    {'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}
                  </div>
                </div>
              </div>
              <p className="text-gray-700 italic">&ldquo;{t.text}&rdquo;</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery Preview */}
      <section>
        <h3 className="text-2xl font-bold text-navy mb-6 flex items-center">
          <span className="w-1 h-10 bg-yellow mr-3"></span>
          Galeri Kegiatan
        </h3>
        <div className="grid md:grid-cols-4 gap-4">
          {galleries.slice(0, 4).map((g) => (
            <div key={g.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 bg-gray-200 flex items-center justify-center text-gray-400">
                {g.imageUrl ? (
                  <img src={g.imageUrl} alt={g.title} className="w-full h-full object-cover" />
                ) : (
                  '[Gambar]'
                )}
              </div>
              <div className="p-3">
                <h4 className="font-semibold text-navy text-sm">{g.title}</h4>
                <p className="text-gray-500 text-xs">{g.category}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )

  // --- LMS TAB ---
  const renderLMS = () => (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-3xl font-bold text-navy flex items-center">
          <span className="w-1 h-10 bg-yellow mr-3"></span>
          Learning Management System
        </h2>
        {(user?.role === 'super-admin' || user?.role === 'admin' || user?.role === 'tutor') && (
          <button
            onClick={() => {
              setEditingModule(null)
              setNewModule({ title: '', description: '', videoUrl: '', audioUrl: '', textContent: '', links: [] })
              document.getElementById('addModuleForm')?.classList.toggle('hidden')
            }}
            className="bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy/90 transition-colors"
          >
            + Tambah Modul
          </button>
        )}
      </div>

      {/* Add/Edit Module Form */}
      {(user?.role === 'super-admin' || user?.role === 'admin' || user?.role === 'tutor') && (
        <div id="addModuleForm" className="bg-white p-6 rounded-xl shadow-md hidden">
          <h3 className="text-xl font-semibold text-navy mb-4">
            {editingModule ? 'Edit Modul' : 'Tambah Modul Baru'}
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Judul Modul"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={editingModule ? editingModule.title : newModule.title || ''}
              onChange={(e) => {
                if (editingModule) {
                  setEditingModule({ ...editingModule, title: e.target.value })
                } else {
                  setNewModule({ ...newModule, title: e.target.value })
                }
              }}
            />
            <textarea
              placeholder="Deskripsi Modul"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent col-span-2"
              rows={3}
              value={editingModule ? editingModule.description : newModule.description || ''}
              onChange={(e) => {
                if (editingModule) {
                  setEditingModule({ ...editingModule, description: e.target.value })
                } else {
                  setNewModule({ ...newModule, description: e.target.value })
                }
              }}
            />
            <input
              type="text"
              placeholder="URL Video YouTube (embed)"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={editingModule ? editingModule.videoUrl : newModule.videoUrl || ''}
              onChange={(e) => {
                if (editingModule) {
                  setEditingModule({ ...editingModule, videoUrl: e.target.value })
                } else {
                  setNewModule({ ...newModule, videoUrl: e.target.value })
                }
              }}
            />
            <input
              type="text"
              placeholder="URL Audio (Google Drive)"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={editingModule ? editingModule.audioUrl : newModule.audioUrl || ''}
              onChange={(e) => {
                if (editingModule) {
                  setEditingModule({ ...editingModule, audioUrl: e.target.value })
                } else {
                  setNewModule({ ...newModule, audioUrl: e.target.value })
                }
              }}
            />
            <textarea
              placeholder="Konten Teks"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent col-span-2"
              rows={4}
              value={editingModule ? editingModule.textContent : newModule.textContent || ''}
              onChange={(e) => {
                if (editingModule) {
                  setEditingModule({ ...editingModule, textContent: e.target.value })
                } else {
                  setNewModule({ ...newModule, textContent: e.target.value })
                }
              }}
            />
            <input
              type="text"
              placeholder="Link Tambahan (pisahkan dengan koma)"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={editingModule ? editingModule.links?.join(', ') || '' : newModule.links?.join(', ') || ''}
              onChange={(e) => {
                const links = e.target.value.split(',').map(s => s.trim())
                if (editingModule) {
                  setEditingModule({ ...editingModule, links })
                } else {
                  setNewModule({ ...newModule, links })
                }
              }}
            />
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Gambar</label>
              <input
                type="file"
                multiple
                accept="image/*"
                className="border border-gray-300 rounded-lg px-4 py-2 w-full"
                onChange={(e) => {
                  if (e.target.files) {
                    setModuleImages(Array.from(e.target.files))
                  }
                }}
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button
                onClick={editingModule ? updateModule : addModule}
                disabled={uploadingModule}
                className="bg-yellow text-navy px-6 py-2 rounded-lg font-semibold hover:bg-yellow/90 transition-colors disabled:opacity-50"
              >
                {uploadingModule ? 'Menyimpan...' : editingModule ? 'Update Modul' : 'Simpan Modul'}
              </button>
              <button
                onClick={() => {
                  document.getElementById('addModuleForm')?.classList.add('hidden')
                  setEditingModule(null)
                }}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modules List */}
      <div className="grid gap-6">
        {modules.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-md text-center text-gray-500">
            Belum ada modul. Tambahkan modul pertama!
          </div>
        ) : (
          modules.map((module) => (
            <div key={module.id} className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-navy">{module.title}</h3>
                  <p className="text-gray-600 mt-1">{module.description}</p>
                  <p className="text-xs text-gray-400 mt-1">Oleh: {module.authorName}</p>
                </div>
                {(user?.role === 'super-admin' || user?.role === 'admin' || user?.uid === module.authorId) && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingModule(module)
                        setNewModule({})
                        document.getElementById('addModuleForm')?.classList.remove('hidden')
                      }}
                      className="text-navy hover:text-yellow transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteModule(module.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
              
              {module.videoUrl && (
                <div className="aspect-video mt-4">
                  <iframe
                    className="w-full h-full rounded-lg"
                    src={module.videoUrl.replace('watch?v=', 'embed/')}
                    allowFullScreen
                  />
                </div>
              )}
              
              {module.audioUrl && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <audio controls className="w-full">
                    <source src={module.audioUrl} />
                    Browser Anda tidak mendukung audio.
                  </audio>
                </div>
              )}
              
              {module.textContent && (
                <div className="mt-4 prose max-w-none" dangerouslySetInnerHTML={{ __html: module.textContent }} />
              )}
              
              {module.imageUrls && module.imageUrls.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {module.imageUrls.map((url, i) => (
                    <img key={i} src={url} alt={`Gambar ${i+1}`} className="rounded-lg object-cover h-32 w-full" />
                  ))}
                </div>
              )}
              
              {module.links && module.links.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {module.links.map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-navy underline text-sm hover:text-yellow transition-colors"
                    >
                      Link {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )

  // --- EXAM TAB ---
  const renderExam = () => {
    if (examSubmitted && currentExam) {
      return (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-xl shadow-md text-center">
            <h2 className="text-3xl font-bold text-navy mb-4">Hasil Ujian</h2>
            <div className="text-6xl font-bold text-yellow mb-4">{examScore.toFixed(1)}%</div>
            <div className="text-gray-600 mb-4">
              {examScore >= 80 ? '🎉 Selamat! Anda lulus dengan nilai sangat baik!' :
               examScore >= 60 ? '👍 Bagus! Terus tingkatkan prestasi Anda!' :
               '💪 Tetap semangat! Belajar lebih giat lagi!'}
            </div>
            <button
              onClick={() => {
                setExamSubmitted(false)
                setExamAnswers({})
                setCurrentExam(null)
                setExamResults({})
              }}
              className="bg-navy text-white px-6 py-2 rounded-lg hover:bg-navy/90 transition-colors"
            >
              Kembali ke Daftar Ujian
            </button>
          </div>

          {/* Review Answers */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-navy">Pembahasan</h3>
            {currentExam.questions.map((q, i) => (
              <div key={q.id} className="bg-white p-6 rounded-xl shadow-md">
                <p className="font-semibold text-navy">
                  {i + 1}. {q.text}
                  <span className={`ml-2 text-sm ${examResults[q.id]?.correct ? 'text-green-600' : 'text-red-600'}`}>
                    {examResults[q.id]?.correct ? '✓' : '✗'}
                  </span>
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Jawaban Anda: {examResults[q.id]?.userAnswer || 'Tidak dijawab'}
                </p>
                <p className="text-sm text-green-600">
                  Jawaban Benar: {examResults[q.id]?.correctAnswer?.join(', ') || '-'}
                </p>
                {q.explanation && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-800 font-medium">Pembahasan:</p>
                    <p className="text-sm text-blue-700">{q.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-3xl font-bold text-navy flex items-center">
            <span className="w-1 h-10 bg-yellow mr-3"></span>
            Ujian Online
          </h2>
          {(user?.role === 'super-admin' || user?.role === 'admin' || user?.role === 'tutor') && (
            <button
              onClick={() => {
                setEditingExam(null)
                setNewExam({ title: '', description: '', questions: [], duration: 60, price: 0, isPaid: false, branch: '', isActive: true })
                document.getElementById('addExamForm')?.classList.toggle('hidden')
              }}
              className="bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy/90 transition-colors"
            >
              + Buat Ujian
            </button>
          )}
        </div>

        {/* Add Exam Form */}
        {(user?.role === 'super-admin' || user?.role === 'admin' || user?.role === 'tutor') && (
          <div id="addExamForm" className="bg-white p-6 rounded-xl shadow-md hidden">
            <h3 className="text-xl font-semibold text-navy mb-4">
              {editingExam ? 'Edit Ujian' : 'Buat Ujian Baru'}
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Judul Ujian"
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
                value={editingExam ? editingExam.title : newExam.title || ''}
                onChange={(e) => {
                  if (editingExam) {
                    setEditingExam({ ...editingExam, title: e.target.value })
                  } else {
                    setNewExam({ ...newExam, title: e.target.value })
                  }
                }}
              />
              <textarea
                placeholder="Deskripsi Ujian"
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent col-span-2"
                rows={3}
                value={editingExam ? editingExam.description : newExam.description || ''}
                onChange={(e) => {
                  if (editingExam) {
                    setEditingExam({ ...editingExam, description: e.target.value })
                  } else {
                    setNewExam({ ...newExam, description: e.target.value })
                  }
                }}
              />
              <input
                type="number"
                placeholder="Durasi (menit)"
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
                value={editingExam ? editingExam.duration : newExam.duration || 60}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  if (editingExam) {
                    setEditingExam({ ...editingExam, duration: val })
                  } else {
                    setNewExam({ ...newExam, duration: val })
                  }
                }}
              />
              <input
                type="number"
                placeholder="Harga (0 jika gratis)"
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
                value={editingExam ? editingExam.price : newExam.price || 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  if (editingExam) {
                    setEditingExam({ ...editingExam, price: val })
                  } else {
                    setNewExam({ ...newExam, price: val })
                  }
                }}
              />
              <input
                type="text"
                placeholder="Cabang"
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
                value={editingExam ? editingExam.branch : newExam.branch || ''}
                onChange={(e) => {
                  if (editingExam) {
                    setEditingExam({ ...editingExam, branch: e.target.value })
                  } else {
                    setNewExam({ ...newExam, branch: e.target.value })
                  }
                }}
              />
              <div className="col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingExam ? editingExam.isPaid : newExam.isPaid || false}
                    onChange={(e) => {
                      if (editingExam) {
                        setEditingExam({ ...editingExam, isPaid: e.target.checked })
                      } else {
                        setNewExam({ ...newExam, isPaid: e.target.checked })
                      }
                    }}
                  />
                  <span>Ujian Berbayar</span>
                </label>
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={editingExam ? editingExam.isActive : newExam.isActive !== false}
                    onChange={(e) => {
                      if (editingExam) {
                        setEditingExam({ ...editingExam, isActive: e.target.checked })
                      } else {
                        setNewExam({ ...newExam, isActive: e.target.checked })
                      }
                    }}
                  />
                  <span>Aktif</span>
                </label>
              </div>

              {/* Questions Builder */}
              <div className="col-span-2">
                <h4 className="font-semibold text-navy mb-2">Soal-Soal</h4>
                {(editingExam?.questions || newExam.questions || []).map((q, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-start">
                      <select
                        className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-navy focus:border-transparent"
                        value={q.type}
                        onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                      >
                        <option value="single">Pilihan Ganda Tunggal</option>
                        <option value="multiple">Pilihan Ganda Kompleks</option>
                        <option value="truefalse">Benar/Salah</option>
                        <option value="matching">Menjodohkan</option>
                        <option value="ordering">Mengurutkan</option>
                        <option value="agree">Setuju/Tidak Setuju</option>
                        <option value="essay">Essay</option>
                      </select>
                      <button
                        onClick={() => removeQuestion(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Hapus
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Pertanyaan"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 mt-2 focus:ring-2 focus:ring-navy focus:border-transparent"
                      value={q.text}
                      onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                    />
                    {q.type === 'single' && q.options && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct_${index}`}
                              checked={q.correctAnswers?.includes(opt) || false}
                              onChange={() => updateQuestion(index, 'correctAnswers', [opt])}
                            />
                            <input
                              type="text"
                              placeholder={`Opsi ${oi + 1}`}
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-navy focus:border-transparent"
                              value={opt}
                              onChange={(e) => {
                                const newOptions = [...q.options!]
                                newOptions[oi] = e.target.value
                                updateQuestion(index, 'options', newOptions)
                              }}
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newOptions = [...q.options!, '']
                            updateQuestion(index, 'options', newOptions)
                          }}
                          className="text-navy text-sm hover:text-yellow transition-colors"
                        >
                          + Tambah Opsi
                        </button>
                      </div>
                    )}
                    {q.type === 'multiple' && q.options && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={q.correctAnswers?.includes(opt) || false}
                              onChange={(e) => {
                                const current = q.correctAnswers || []
                                const newCorrect = e.target.checked
                                  ? [...current, opt]
                                  : current.filter((a: string) => a !== opt)
                                updateQuestion(index, 'correctAnswers', newCorrect)
                              }}
                            />
                            <input
                              type="text"
                              placeholder={`Opsi ${oi + 1}`}
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-navy focus:border-transparent"
                              value={opt}
                              onChange={(e) => {
                                const newOptions = [...q.options!]
                                newOptions[oi] = e.target.value
                                updateQuestion(index, 'options', newOptions)
                              }}
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newOptions = [...q.options!, '']
                            updateQuestion(index, 'options', newOptions)
                          }}
                          className="text-navy text-sm hover:text-yellow transition-colors"
                        >
                          + Tambah Opsi
                        </button>
                      </div>
                    )}
                    {q.type === 'truefalse' && (
                      <div className="mt-2 flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`tf_${index}`}
                            checked={q.correctAnswers?.[0] === 'true'}
                            onChange={() => updateQuestion(index, 'correctAnswers', ['true'])}
                          />
                          Benar
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`tf_${index}`}
                            checked={q.correctAnswers?.[0] === 'false'}
                            onChange={() => updateQuestion(index, 'correctAnswers', ['false'])}
                          />
                          Salah
                        </label>
                      </div>
                    )}
                    {q.type === 'matching' && (
                      <div className="mt-2 space-y-2">
                        {(q.pairs || []).map((pair, pi) => (
                          <div key={pi} className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Kiri"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-navy focus:border-transparent"
                              value={pair.left}
                              onChange={(e) => {
                                const newPairs = [...(q.pairs || [])]
                                newPairs[pi] = { ...newPairs[pi], left: e.target.value }
                                updateQuestion(index, 'pairs', newPairs)
                              }}
                            />
                            <span>→</span>
                            <input
                              type="text"
                              placeholder="Kanan"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-navy focus:border-transparent"
                              value={pair.right}
                              onChange={(e) => {
                                const newPairs = [...(q.pairs || [])]
                                newPairs[pi] = { ...newPairs[pi], right: e.target.value }
                                updateQuestion(index, 'pairs', newPairs)
                              }}
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newPairs = [...(q.pairs || []), { left: '', right: '' }]
                            updateQuestion(index, 'pairs', newPairs)
                          }}
                          className="text-navy text-sm hover:text-yellow transition-colors"
                        >
                          + Tambah Pasangan
                        </button>
                      </div>
                    )}
                    {q.type === 'ordering' && (
                      <div className="mt-2 space-y-1">
                        {(q.orderItems || []).map((item, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">{oi + 1}.</span>
                            <input
                              type="text"
                              placeholder={`Item ${oi + 1}`}
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-navy focus:border-transparent"
                              value={item}
                              onChange={(e) => {
                                const newItems = [...(q.orderItems || [])]
                                newItems[oi] = e.target.value
                                updateQuestion(index, 'orderItems', newItems)
                              }}
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newItems = [...(q.orderItems || []), '']
                            updateQuestion(index, 'orderItems', newItems)
                          }}
                          className="text-navy text-sm hover:text-yellow transition-colors"
                        >
                          + Tambah Item
                        </button>
                      </div>
                    )}
                    {q.type === 'agree' && (
                      <div className="mt-2 flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`agree_${index}`}
                            checked={q.correctAnswers?.[0] === 'agree'}
                            onChange={() => updateQuestion(index, 'correctAnswers', ['agree'])}
                          />
                          Setuju
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`agree_${index}`}
                            checked={q.correctAnswers?.[0] === 'disagree'}
                            onChange={() => updateQuestion(index, 'correctAnswers', ['disagree'])}
                          />
                          Tidak Setuju
                        </label>
                      </div>
                    )}
                    {q.type === 'essay' && (
                      <p className="text-sm text-gray-500 mt-2">Essay akan dinilai manual oleh tutor</p>
                    )}
                    <textarea
                      placeholder="Pembahasan (opsional)"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 mt-2 text-sm focus:ring-2 focus:ring-navy focus:border-transparent"
                      rows={2}
                      value={q.explanation || ''}
                      onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                    />
                  </div>
                ))}
                <button
                  onClick={addQuestion}
                  className="bg-gray-100 text-navy px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  + Tambah Soal
                </button>
              </div>

              <div className="col-span-2 flex gap-2">
                <button
                  onClick={editingExam ? () => {
                    // Update exam logic
                    alert('Fitur update exam sedang dalam pengembangan')
                  } : addExam}
                  className="bg-yellow text-navy px-6 py-2 rounded-lg font-semibold hover:bg-yellow/90 transition-colors"
                >
                  {editingExam ? 'Update Ujian' : 'Simpan Ujian'}
                </button>
                <button
                  onClick={() => {
                    document.getElementById('addExamForm')?.classList.add('hidden')
                    setEditingExam(null)
                  }}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Exam List */}
        {!currentExam ? (
          <div className="grid gap-4">
            {exams.length === 0 ? (
              <div className="bg-white p-8 rounded-xl shadow-md text-center text-gray-500">
                Belum ada ujian. Buat ujian pertama!
              </div>
            ) : (
              exams.filter(e => e.isActive).map((exam) => (
                <div key={exam.id} className="bg-white p-6 rounded-xl shadow-md flex flex-wrap justify-between items-center">
                  <div>
                    <h3 className="text-xl font-semibold text-navy">{exam.title}</h3>
                    <p className="text-gray-600">{exam.description}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                      <span>📝 {exam.questions.length} soal</span>
                      <span>⏱️ {exam.duration} menit</span>
                      {exam.price > 0 && <span>💰 Rp {exam.price.toLocaleString()}</span>}
                      <span>🏫 {exam.branch}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentExam(exam)
                      setExamAnswers({})
                      setExamSubmitted(false)
                      setExamResults({})
                    }}
                    className="bg-yellow text-navy px-6 py-2 rounded-lg font-semibold hover:bg-yellow/90 transition-colors"
                  >
                    Mulai Ujian
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          // Exam Taking
          <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-navy">{currentExam.title}</h3>
                <p className="text-gray-600">{currentExam.description}</p>
              </div>
              <button
                onClick={() => setCurrentExam(null)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {currentExam.questions.map((q, index) => (
                <div key={q.id} className="border-b border-gray-200 pb-4">
                  <p className="font-semibold text-navy mb-2">
                    {index + 1}. {q.text}
                  </p>
                  {q.type === 'single' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                          <input
                            type="radio"
                            name={q.id}
                            value={opt}
                            onChange={(e) =>
                              setExamAnswers({ ...examAnswers, [q.id]: e.target.value })
                            }
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'multiple' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            value={opt}
                            onChange={(e) => {
                              const current = examAnswers[q.id] || []
                              const newValue = e.target.checked
                                ? [...current, opt]
                                : current.filter((a: string) => a !== opt)
                              setExamAnswers({ ...examAnswers, [q.id]: newValue })
                            }}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'truefalse' && (
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                        <input
                          type="radio"
                          name={q.id}
                          value="true"
                          onChange={(e) =>
                            setExamAnswers({ ...examAnswers, [q.id]: e.target.value })
                          }
                        />
                        Benar
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                        <input
                          type="radio"
                          name={q.id}
                          value="false"
                          onChange={(e) =>
                            setExamAnswers({ ...examAnswers, [q.id]: e.target.value })
                          }
                        />
                        Salah
                      </label>
                    </div>
                  )}
                  {q.type === 'matching' && q.pairs && (
                    <div className="space-y-2">
                      {q.pairs.map((pair, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className="font-medium text-navy">{pair.left}</span>
                          <input
                            type="text"
                            placeholder="Jawaban"
                            className="border border-gray-300 rounded-lg px-3 py-1 flex-1 focus:ring-2 focus:ring-navy focus:border-transparent"
                            onChange={(e) => {
                              const current = examAnswers[q.id] || {}
                              setExamAnswers({
                                ...examAnswers,
                                [q.id]: { ...current, [pair.left]: e.target.value },
                              })
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === 'ordering' && q.orderItems && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Urutkan dari yang paling benar</p>
                      {q.orderItems.map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={q.orderItems?.length}
                            className="border border-gray-300 rounded-lg w-16 px-2 py-1 focus:ring-2 focus:ring-navy focus:border-transparent"
                            onChange={(e) => {
                              const current = examAnswers[q.id] || {}
                              const order = parseInt(e.target.value)
                              if (!isNaN(order) && order > 0 && order <= (q.orderItems?.length || 0)) {
                                setExamAnswers({
                                  ...examAnswers,
                                  [q.id]: { ...current, [item]: order },
                                })
                              }
                            }}
                          />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === 'agree' && (
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                        <input
                          type="radio"
                          name={q.id}
                          value="agree"
                          onChange={(e) =>
                            setExamAnswers({ ...examAnswers, [q.id]: e.target.value })
                          }
                        />
                        Setuju
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                        <input
                          type="radio"
                          name={q.id}
                          value="disagree"
                          onChange={(e) =>
                            setExamAnswers({ ...examAnswers, [q.id]: e.target.value })
                          }
                        />
                        Tidak Setuju
                      </label>
                    </div>
                  )}
                  {q.type === 'essay' && (
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 min-h-[100px] focus:ring-2 focus:ring-navy focus:border-transparent"
                      placeholder="Tulis jawaban Anda..."
                      onChange={(e) =>
                        setExamAnswers({ ...examAnswers, [q.id]: e.target.value })
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleExamSubmit}
              className="mt-6 bg-yellow text-navy px-8 py-3 rounded-lg font-semibold hover:bg-yellow/90 transition-colors w-full md:w-auto"
            >
              Submit Ujian
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- FINANCE TAB ---
  const renderFinance = () => {
    const filteredTransactions = getFilteredTransactions()
    const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    const balance = totalIncome - totalExpense

    return (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold text-navy flex items-center">
          <span className="w-1 h-10 bg-yellow mr-3"></span>
          Keuangan & Administrasi
        </h2>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-md flex flex-wrap gap-4 items-center">
          <select
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value as any)}
          >
            <option value="daily">Harian</option>
            <option value="weekly">Mingguan</option>
            <option value="monthly">Bulanan</option>
            <option value="yearly">Tahunan</option>
          </select>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
            value={filterDate.toISOString().split('T')[0]}
            onChange={(e) => setFilterDate(new Date(e.target.value))}
          />
          <select
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="all">Semua Cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500">
            <p className="text-gray-600 text-sm">Total Pemasukan</p>
            <p className="text-2xl font-bold text-green-600">
              Rp {totalIncome.toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-500">
            <p className="text-gray-600 text-sm">Total Pengeluaran</p>
            <p className="text-2xl font-bold text-red-600">
              Rp {totalExpense.toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-navy">
            <p className="text-gray-600 text-sm">Saldo</p>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-navy' : 'text-red-600'}`}>
              Rp {balance.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Add Transaction Form */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-xl font-semibold text-navy mb-4">Tambah Transaksi</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <select
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={newTransaction.type}
              onChange={(e) =>
                setNewTransaction({
                  ...newTransaction,
                  type: e.target.value as 'income' | 'expense',
                })
              }
            >
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
            </select>
            <input
              type="number"
              placeholder="Jumlah"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={newTransaction.amount || ''}
              onChange={(e) =>
                setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) })
              }
            />
            <input
              type="text"
              placeholder="Kategori"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={newTransaction.category || ''}
              onChange={(e) =>
                setNewTransaction({ ...newTransaction, category: e.target.value })
              }
            />
            <select
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={newTransaction.branch || ''}
              onChange={(e) =>
                setNewTransaction({ ...newTransaction, branch: e.target.value })
              }
            >
              <option value="">Pilih Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
            <select
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={newTransaction.paymentMethod || 'cash'}
              onChange={(e) =>
                setNewTransaction({ ...newTransaction, paymentMethod: e.target.value as any })
              }
            >
              <option value="cash">Tunai</option>
              <option value="transfer">Transfer</option>
              <option value="pakkasir">Pakkasir</option>
            </select>
            <input
              type="text"
              placeholder="Deskripsi"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={newTransaction.description || ''}
              onChange={(e) =>
                setNewTransaction({ ...newTransaction, description: e.target.value })
              }
            />
            <button
              onClick={addTransaction}
              className="bg-navy text-white px-6 py-2 rounded-lg hover:bg-navy/90 transition-colors col-span-3"
            >
              Tambah Transaksi
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cabang</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm">
                      {t.date?.toDate?.().toLocaleDateString() || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          t.type === 'income'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{t.category}</td>
                    <td className="px-6 py-4 text-sm">{t.branch}</td>
                    <td className="px-6 py-4 text-sm">{t.paymentMethod}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-right">
                      Rp {t.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Arrears */}
        <div>
          <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            <h3 className="text-2xl font-bold text-navy flex items-center">
              <span className="w-1 h-8 bg-yellow mr-3"></span>
              Tunggakan
            </h3>
            <div className="flex gap-2">
              <button
                onClick={sendArrearReminders}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors text-sm"
              >
                Kirim Pengingat WA
              </button>
            </div>
          </div>

          {/* Add Arrear Form */}
          <div className="bg-white p-4 rounded-xl shadow-md mb-4">
            <div className="grid md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Nama Siswa"
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
                value={newArrear.studentName || ''}
                onChange={(e) => setNewArrear({ ...newArrear, studentName: e.target.value })}
              />
              <input
                type="number"
                placeholder="Jumlah"
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
                value={newArrear.amount || ''}
                onChange={(e) => setNewArrear({ ...newArrear, amount: parseFloat(e.target.value) })}
              />
              <select
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
                value={newArrear.branch || ''}
                onChange={(e) => setNewArrear({ ...newArrear, branch: e.target.value })}
              >
                <option value="">Pilih Cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
              <select
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
                value={newArrear.packageType || 'monthly'}
                onChange={(e) => setNewArrear({ ...newArrear, packageType: e.target.value as any })}
              >
                <option value="monthly">Bulanan</option>
                <option value="meeting">Paket Meeting</option>
                <option value="event">Event</option>
                <option value="package">Paket</option>
              </select>
              <button
                onClick={addArrear}
                className="bg-yellow text-navy px-4 py-2 rounded-lg font-semibold hover:bg-yellow/90 transition-colors"
              >
                Tambah Tunggakan
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Siswa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jatuh Tempo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cabang</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paket</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {arrears.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm">{a.studentName}</td>
                      <td className="px-6 py-4 text-sm font-semibold">Rp {a.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">
                        {a.dueDate?.toDate?.().toLocaleDateString() || '-'}
                        {!a.paid && new Date() > a.dueDate?.toDate?.() && (
                          <span className="ml-2 text-red-500 text-xs font-bold">LEWAT</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">{a.branch}</td>
                      <td className="px-6 py-4 text-sm">{a.packageType}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            a.paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {a.paid ? 'Lunas' : 'Belum Bayar'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {!a.paid && (
                          <button
                            onClick={() => payArrear(a.id)}
                            className="bg-navy text-white px-3 py-1 rounded-lg text-sm hover:bg-navy/90 transition-colors"
                          >
                            Bayar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- PAYMENT TAB ---
  const renderPayment = () => (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-navy flex items-center">
        <span className="w-1 h-10 bg-yellow mr-3"></span>
        Payment Gateway
      </h2>

      {/* Pakkasir Toggle */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-navy">Pakkasir Payment Gateway</h3>
            <p className="text-gray-600">Aktifkan untuk pembayaran otomatis via Pakkasir</p>
          </div>
          <button
            onClick={() => setIsPakkasirActive(!isPakkasirActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isPakkasirActive ? 'bg-navy' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isPakkasirActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Payment Form */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-xl font-semibold text-navy mb-4">
          {isPakkasirActive ? 'Pembayaran via Pakkasir' : 'Pembayaran Manual Transfer'}
        </h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Siswa</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={paymentStudent}
              onChange={(e) => setPaymentStudent(e.target.value)}
              placeholder="Nama lengkap siswa"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Pembayaran</label>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Masukkan nominal"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Catatan tambahan (opsional)"
              rows={2}
            />
          </div>
        </div>

        {isPakkasirActive ? (
          <button
            onClick={createPakkasirPayment}
            disabled={paymentLoading}
            className="mt-4 bg-navy text-white px-8 py-3 rounded-lg font-semibold hover:bg-navy/90 transition-colors disabled:opacity-50 w-full md:w-auto"
          >
            {paymentLoading ? 'Memproses...' : 'Bayar dengan Pakkasir'}
          </button>
        ) : (
          <form onSubmit={handleBankTransfer} className="mt-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Bukti Transfer</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  onChange={(e) => setBankTransferFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={paymentLoading}
                className="bg-yellow text-navy px-8 py-3 rounded-lg font-semibold hover:bg-yellow/90 transition-colors disabled:opacity-50"
              >
                {paymentLoading ? 'Uploading...' : 'Konfirmasi Pembayaran'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Payment History */}
      <div>
        <h3 className="text-2xl font-bold text-navy mb-4 flex items-center">
          <span className="w-1 h-8 bg-yellow mr-3"></span>
          Riwayat Pembayaran
        </h3>
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Siswa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metode</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm">
                      {p.createdAt?.toDate?.().toLocaleDateString() || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">{p.studentName}</td>
                    <td className="px-6 py-4 text-sm font-semibold">Rp {p.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">{p.method}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          p.status === 'success' || p.status === 'verified'
                            ? 'bg-green-100 text-green-800'
                            : p.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {p.status === 'success' ? 'Berhasil' :
                         p.status === 'verified' ? 'Diverifikasi' :
                         p.status === 'pending' ? 'Menunggu' : 'Gagal'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {p.status === 'pending' && p.method === 'transfer' && 
                       (user?.role === 'super-admin' || user?.role === 'admin') && (
                        <button
                          onClick={() => verifyPayment(p.id)}
                          className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600 transition-colors"
                        >
                          Verifikasi
                        </button>
                      )}
                      {p.pakkasirPaymentUrl && (
                        <a
                          href={p.pakkasirPaymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-navy text-sm hover:text-yellow transition-colors ml-2"
                        >
                          Lihat
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )

  // --- EVENT TAB ---
  const renderEvent = () => (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-3xl font-bold text-navy flex items-center">
          <span className="w-1 h-10 bg-yellow mr-3"></span>
          Event & Lomba
        </h2>
        {(user?.role === 'super-admin' || user?.role === 'admin') && (
          <button
            onClick={() => {
              setEditingEvent(null)
              setNewEvent({ title: '', description: '', type: 'tryout', price: 0, branch: '', status: 'draft', maxParticipants: 100, currentParticipants: 0 })
              document.getElementById('addEventForm')?.classList.toggle('hidden')
            }}
            className="bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy/90 transition-colors"
          >
            + Buat Event
          </button>
        )}
      </div>

      {/* Add Event Form */}
      {(user?.role === 'super-admin' || user?.role === 'admin') && (
        <div id="addEventForm" className="bg-white p-6 rounded-xl shadow-md hidden">
          <h3 className="text-xl font-semibold text-navy mb-4">
            {editingEvent ? 'Edit Event' : 'Buat Event Baru'}
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Judul Event"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={editingEvent ? editingEvent.title : newEvent.title || ''}
              onChange={(e) => {
                if (editingEvent) {
                  setEditingEvent({ ...editingEvent, title: e.target.value })
                } else {
                  setNewEvent({ ...newEvent, title: e.target.value })
                }
              }}
            />
            <textarea
              placeholder="Deskripsi Event"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent col-span-2"
              rows={3}
              value={editingEvent ? editingEvent.description : newEvent.description || ''}
              onChange={(e) => {
                if (editingEvent) {
                  setEditingEvent({ ...editingEvent, description: e.target.value })
                } else {
                  setNewEvent({ ...newEvent, description: e.target.value })
                }
              }}
            />
            <select
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={editingEvent ? editingEvent.type : newEvent.type || 'tryout'}
              onChange={(e) => {
                if (editingEvent) {
                  setEditingEvent({ ...editingEvent, type: e.target.value as any })
                } else {
                  setNewEvent({ ...newEvent, type: e.target.value as any })
                }
              }}
            >
              <option value="tryout">Try Out</option>
              <option value="olympiad">Olimpiade</option>
              <option value="workshop">Workshop</option>
              <option value="seminar">Seminar</option>
            </select>
            <input
              type="number"
              placeholder="Harga"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={editingEvent ? editingEvent.price : newEvent.price || 0}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (editingEvent) {
                  setEditingEvent({ ...editingEvent, price: val })
                } else {
                  setNewEvent({ ...newEvent, price: val })
                }
              }}
            />
            <input
              type="number"
              placeholder="Maksimal Peserta"
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={editingEvent ? editingEvent.maxParticipants : newEvent.maxParticipants || 100}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                if (editingEvent) {
                  setEditingEvent({ ...editingEvent, maxParticipants: val })
                } else {
                  setNewEvent({ ...newEvent, maxParticipants: val })
                }
              }}
            />
            <select
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={editingEvent ? editingEvent.branch : newEvent.branch || ''}
              onChange={(e) => {
                if (editingEvent) {
                  setEditingEvent({ ...editingEvent, branch: e.target.value })
                } else {
                  setNewEvent({ ...newEvent, branch: e.target.value })
                }
              }}
            >
              <option value="">Pilih Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
            <select
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
              value={editingEvent ? editingEvent.status : newEvent.status || 'draft'}
              onChange={(e) => {
                if (editingEvent) {
                  setEditingEvent({ ...editingEvent, status: e.target.value as any })
                } else {
                  setNewEvent({ ...newEvent, status: e.target.value as any })
                }
              }}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
              <option value="completed">Completed</option>
            </select>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Banner Event</label>
              <input
                type="file"
                accept="image/*"
                className="border border-gray-300 rounded-lg px-4 py-2 w-full"
                onChange={(e) => setEventBanner(e.target.files?.[0] || null)}
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button
                onClick={editingEvent ? () => {
                  alert('Fitur update event sedang dalam pengembangan')
                } : addEvent}
                className="bg-yellow text-navy px-6 py-2 rounded-lg font-semibold hover:bg-yellow/90 transition-colors"
              >
                {editingEvent ? 'Update Event' : 'Simpan Event'}
              </button>
              <button
                onClick={() => {
                  document.getElementById('addEventForm')?.classList.add('hidden')
                  setEditingEvent(null)
                }}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="grid md:grid-cols-2 gap-6">
        {events.map((event) => (
          <div key={event.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            {event.bannerImage && (
              <img src={event.bannerImage} alt={event.title} className="w-full h-48 object-cover" />
            )}
            <div className="p-6">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-semibold text-navy">{event.title}</h3>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    event.status === 'published'
                      ? 'bg-green-100 text-green-800'
                      : event.status === 'draft'
                      ? 'bg-gray-100 text-gray-800'
                      : event.status === 'closed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {event.status}
                </span>
              </div>
              <p className="text-gray-600 mt-2 text-sm">{event.description}</p>
              <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                <div>
                  <span className="text-gray-500">Tipe:</span>
                  <span className="ml-1 font-medium">{event.type}</span>
                </div>
                <div>
                  <span className="text-gray-500">Harga:</span>
                  <span className="ml-1 font-medium">Rp {event.price.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Cabang:</span>
                  <span className="ml-1 font-medium">{event.branch}</span>
                </div>
                <div>
                  <span className="text-gray-500">Peserta:</span>
                  <span className="ml-1 font-medium">{event.currentParticipants}/{event.maxParticipants}</span>
                </div>
              </div>
              {event.status === 'published' && (
                <button className="mt-4 bg-yellow text-navy px-4 py-2 rounded-lg font-semibold hover:bg-yellow/90 transition-colors w-full">
                  Daftar Sekarang
                </button>
              )}
              {(user?.role === 'super-admin' || user?.role === 'admin') && event.status === 'draft' && (
                <button
                  onClick={() => publishEvent(event.id)}
                  className="mt-2 bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors w-full"
                >
                  Publikasikan
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // --- CERTIFICATE TAB ---
  const renderCertificate = () => (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-navy flex items-center">
        <span className="w-1 h-10 bg-yellow mr-3"></span>
        E-Sertifikat
      </h2>

      {/* Generate Certificate */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-xl font-semibold text-navy mb-4">Buat Sertifikat</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Nama Penerima"
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
            value={certificateStudent}
            onChange={(e) => setCertificateStudent(e.target.value)}
          />
          <input
            type="text"
            placeholder="Judul Sertifikat"
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
            value={certificateTitle}
            onChange={(e) => setCertificateTitle(e.target.value)}
          />
          <input
            type="number"
            placeholder="Nilai (opsional)"
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
            value={certificateScore}
            onChange={(e) => setCertificateScore(e.target.value)}
          />
          <select
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
            value={certificateTemplate}
            onChange={(e) => setCertificateTemplate(e.target.value as any)}
          >
            <option value="premium">Premium</option>
            <option value="standard">Standard</option>
            <option value="simple">Simple</option>
          </select>
          <button
            onClick={generateCertificate}
            disabled={generatingCertificate}
            className="col-span-2 bg-yellow text-navy px-8 py-3 rounded-lg font-semibold hover:bg-yellow/90 transition-colors disabled:opacity-50"
          >
            {generatingCertificate ? 'Memproses...' : 'Generate Sertifikat'}
          </button>
        </div>
      </div>

      {/* Certificate History */}
      <div>
        <h3 className="text-2xl font-bold text-navy mb-4 flex items-center">
          <span className="w-1 h-8 bg-yellow mr-3"></span>
          Sertifikat Saya
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {certificates.map((cert) => (
            <div key={cert.id} className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="w-full h-40 bg-gradient-to-br from-navy to-navy/80 rounded-lg flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="text-4xl mb-2">📜</div>
                  <p className="font-bold text-sm">{cert.title}</p>
                  <p className="text-xs text-yellow/80">{cert.studentName}</p>
                  {cert.score && <p className="text-xs">Nilai: {cert.score}%</p>}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm text-gray-600">Diterbitkan: {cert.issuedAt?.toDate?.().toLocaleDateString()}</p>
                <a
                  href={cert.certificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-navy text-sm hover:text-yellow transition-colors"
                >
                  Download PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // --- GALLERY TAB ---
  const renderGallery = () => {
    const [galleryTitle, setGalleryTitle] = useState('')
    const [galleryCategory, setGalleryCategory] = useState<'prestasi' | 'aktivitas' | 'event'>('aktivitas')
    const [galleryDescription, setGalleryDescription] = useState('')
    const [galleryFile, setGalleryFile] = useState<File | null>(null)
    const [uploadingGallery, setUploadingGallery] = useState(false)

    const handleGallerySubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!galleryFile || !galleryTitle) {
        alert('Mohon pilih gambar dan isi judul')
        return
      }
      setUploadingGallery(true)
      await addGallery(galleryFile, galleryTitle, galleryCategory, galleryDescription)
      setGalleryTitle('')
      setGalleryDescription('')
      setGalleryFile(null)
      setUploadingGallery(false)
    }

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-3xl font-bold text-navy flex items-center">
            <span className="w-1 h-10 bg-yellow mr-3"></span>
            Galeri
          </h2>
          {(user?.role === 'super-admin' || user?.role === 'admin') && (
            <button
              onClick={() => document.getElementById('addGalleryForm')?.classList.toggle('hidden')}
              className="bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy/90 transition-colors"
            >
              + Tambah Gambar
            </button>
          )}
        </div>

        {/* Add Gallery Form */}
        {(user?.role === 'super-admin' || user?.role === 'admin') && (
          <form id="addGalleryForm" onSubmit={handleGallerySubmit} className="bg-white p-6 rounded-xl shadow-md hidden">
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Judul Gambar"
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
                value={galleryTitle}
                onChange={(e) => setGalleryTitle(e.target.value)}
                required
              />
              <select
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent"
                value={galleryCategory}
                onChange={(e) => setGalleryCategory(e.target.value as any)}
              >
                <option value="prestasi">Prestasi</option>
                <option value="aktivitas">Aktivitas</option>
                <option value="event">Event</option>
              </select>
              <textarea
                placeholder="Deskripsi"
                className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-transparent col-span-2"
                rows={2}
                value={galleryDescription}
                onChange={(e) => setGalleryDescription(e.target.value)}
              />
              <div className="col-span-2">
                <input
                  type="file"
                  accept="image/*"
                  className="border border-gray-300 rounded-lg px-4 py-2 w-full"
                  onChange={(e) => setGalleryFile(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={uploadingGallery}
                className="col-span-2 bg-yellow text-navy px-6 py-2 rounded-lg font-semibold hover:bg-yellow/90 transition-colors disabled:opacity-50"
              >
                {uploadingGallery ? 'Uploading...' : 'Upload Gambar'}
              </button>
            </div>
          </form>
        )}

        {/* Gallery Grid */}
        <div className="grid md:grid-cols-4 gap-4">
          {galleries.map((g) => (
            <div key={g.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="h-48 bg-gray-200 flex items-center justify-center">
                {g.imageUrl ? (
                  <img src={g.imageUrl} alt={g.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400">No Image</span>
                )}
              </div>
              <div className="p-3">
                <h4 className="font-semibold text-navy text-sm">{g.title}</h4>
                <p className="text-gray-500 text-xs">{g.category}</p>
                <p className="text-gray-400 text-xs mt-1">{g.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // --- MAIN RENDER ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-navy border-t-yellow rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-navy font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return renderAuth()
  }

  return renderDashboard()
}

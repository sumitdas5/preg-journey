import { PatientTimeline, PregnancyTimeline } from '@/components/patient'
import {
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    ConsultationStatusBadge,
    Input,
    Modal,
    PatientStatusBadge,
    RiskBadge,
    Select,
    Table,
    TableBody,
    TableCell,
    TableEmpty,
    TableHead,
    TableRow,
} from '@/components/ui'
import { alertService, consultationService, followUpService, healthCheckService, patientService, userService } from '@/services'
import { useAuthStore } from '@/store/authStore'
import { ConsultationRequest, ConsultationType, DeliveryCompletionRequest, DeliveryOutcome, DeliveryType, PaginatedResponse, Patient, User, UserRole, PreviousPregnancy, PregnancyOutcome } from '@/types'
import {
    ArrowLeftIcon,
    CalendarIcon,
    CheckCircleIcon,
    IdentificationIcon,
    MapPinIcon,
    PencilIcon,
    PhoneIcon,
    TrashIcon,
    VideoCameraIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'

const DELIVERY_OUTCOMES = [
  { value: DeliveryOutcome.SUCCESSFUL, label: 'Successful Delivery' },
  { value: DeliveryOutcome.MOTHER_MORTALITY, label: 'Mother Mortality' },
  { value: DeliveryOutcome.BABY_MORTALITY, label: 'Baby Mortality' },
  { value: DeliveryOutcome.BOTH_MORTALITY, label: 'Both Mother & Baby Mortality' },
]

const DELIVERY_TYPES = [
  { value: DeliveryType.NORMAL, label: 'Normal Delivery' },
  { value: DeliveryType.CESAREAN, label: 'Cesarean (C-Section)' },
  { value: DeliveryType.ASSISTED, label: 'Assisted (Forceps/Vacuum)' },
  { value: DeliveryType.INDUCED, label: 'Induced Labor' },
]

// Dropdown options for gravida/para
const PREGNANCY_COUNT_OPTIONS = Array.from({ length: 11 }, (_, i) => i)

const PREGNANCY_OUTCOME_OPTIONS = [
  { value: 'LIVE_BIRTH', label: 'Live Birth' },
  { value: 'ABORTION', label: 'Abortion' },
  { value: 'STILLBIRTH', label: 'Stillbirth' },
  { value: 'MISCARRIAGE', label: 'Miscarriage' },
  { value: 'ECTOPIC', label: 'Ectopic Pregnancy' },
]

const PREVIOUS_DELIVERY_TYPE_OPTIONS = [
  { value: 'NORMAL', label: 'Normal Delivery' },
  { value: 'CESAREAN', label: 'C-Section' },
  { value: 'ASSISTED', label: 'Assisted Delivery' },
  { value: 'INDUCED', label: 'Induced Delivery' },
]

const BABY_GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
]

// eslint-disable-next-line sonarjs/cognitive-complexity
export default function PatientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeliveryModal, setShowDeliveryModal] = useState(false)
  const [showConsultationModal, setShowConsultationModal] = useState(false)
  const [editData, setEditData] = useState<Partial<Patient>>({})
  const [editPreviousPregnancies, setEditPreviousPregnancies] = useState<PreviousPregnancy[]>([])
  const [deliveryData, setDeliveryData] = useState<Partial<DeliveryCompletionRequest>>({
    deliveryOutcome: DeliveryOutcome.SUCCESSFUL,
    deliveryType: DeliveryType.NORMAL,
    deliveryDate: new Date().toISOString().split('T')[0],
    numberOfBabies: 1,
    babies: [{ gender: '', weight: undefined, birthOrder: 1 }],
  })
  const [consultationData, setConsultationData] = useState<Partial<ConsultationRequest>>({
    type: ConsultationType.TELECONSULTATION,
    scheduledAt: '',
    chiefComplaint: '',
  })

  const patientId = parseInt(id || '0')

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientService.getById(patientId),
    enabled: !!patientId,
  })

  const { data: alerts } = useQuery({
    queryKey: ['patientAlerts', patientId],
    queryFn: () => alertService.getByPatient(patientId),
    enabled: !!patientId,
  })

  const { data: healthChecks } = useQuery({
    queryKey: ['patientHealthChecks', patientId],
    queryFn: () => healthCheckService.getByPatient(patientId),
    enabled: !!patientId,
  })

  const { data: consultations } = useQuery({
    queryKey: ['patientConsultations', patientId],
    queryFn: () => consultationService.getByPatient(patientId),
    enabled: !!patientId,
  })

  const { data: followUps } = useQuery({
    queryKey: ['patientFollowUps', patientId],
    queryFn: () => followUpService.getByPatient(patientId),
    enabled: !!patientId,
  })

  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: userService.getDoctors,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Patient>) => patientService.update(patientId, data),
    onSuccess: () => {
      toast.success('Patient updated successfully')
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      setShowEditModal(false)
    },
    onError: () => {
      toast.error('Failed to update patient')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => patientService.delete(patientId),
    onSuccess: () => {
      queryClient.setQueriesData<PaginatedResponse<Patient>>(
        { queryKey: ['patients'] },
        (oldData) => {
          if (!oldData) return oldData

          const filteredContent = oldData.content.filter((p) => p.id !== patientId)
          const wasRemoved = filteredContent.length !== oldData.content.length

          if (!wasRemoved) {
            return oldData
          }

          return {
            ...oldData,
            content: filteredContent,
            totalElements: Math.max(0, oldData.totalElements - 1),
          }
        }
      )
      queryClient.removeQueries({ queryKey: ['patient', patientId] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success('Patient deleted successfully')
      navigate('/patients')
    },
    onError: () => {
      toast.error('Failed to delete patient')
    },
  })

  const deliveryMutation = useMutation({
    mutationFn: (data: DeliveryCompletionRequest) => patientService.completeDelivery(patientId, data),
    onSuccess: () => {
      toast.success('Delivery recorded successfully')
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
      setShowDeliveryModal(false)
    },
    onError: () => {
      toast.error('Failed to record delivery')
    },
  })

  const consultationMutation = useMutation({
    mutationFn: (data: ConsultationRequest) => consultationService.schedule(data),
    onSuccess: () => {
      toast.success('Consultation scheduled successfully')
      queryClient.invalidateQueries({ queryKey: ['patientConsultations', patientId] })
      queryClient.invalidateQueries({ queryKey: ['consultations'] })
      setShowConsultationModal(false)
      setConsultationData({
        type: ConsultationType.TELECONSULTATION,
        scheduledAt: '',
        chiefComplaint: '',
      })
    },
    onError: () => {
      toast.error('Failed to schedule consultation')
    },
  })

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    const submissionData = {
      ...editData,
      previousPregnancies: editPreviousPregnancies.length > 0 ? editPreviousPregnancies : undefined,
    }
    updateMutation.mutate(submissionData)
  }

  const openEditModal = () => {
    if (patient) {
      setEditData({
        name: patient.name,
        age: patient.age,
        husbandName: patient.husbandName,
        residence: patient.residence,
        district: patient.district,
        mandal: patient.mandal,
        village: patient.village,
        pincode: patient.pincode,
        mobileNumber: patient.mobileNumber,
        alternateMobile: patient.alternateMobile,
        email: patient.email,
        // Pregnancy Information
        lmpDate: patient.lmpDate,
        gravida: patient.gravida,
        para: patient.para,
        bloodGroup: patient.bloodGroup,
        // Medical History & Complications
        hasPreviousComplications: patient.hasPreviousComplications,
        previousComplicationsDetails: patient.previousComplicationsDetails,
        medicalHistory: patient.medicalHistory,
        allergies: patient.allergies,
        // Previous Pregnancy Details
        hadCSectionDelivery: patient.hadCSectionDelivery,
        hadNormalDelivery: patient.hadNormalDelivery,
        hadAbortion: patient.hadAbortion,
        hadOtherPregnancy: patient.hadOtherPregnancy,
        otherPregnancyDetails: patient.otherPregnancyDetails,
        totalKidsBorn: patient.totalKidsBorn,
      })

      // Initialize previous pregnancies from JSON or create empty array
      let prevPregnancies: PreviousPregnancy[] = []
      if (patient.previousPregnanciesJson) {
        try {
          prevPregnancies = JSON.parse(patient.previousPregnanciesJson)
        } catch {
          prevPregnancies = []
        }
      }
      // If no JSON data but para exists, create placeholder entries based on number of deliveries
      const paraNum = patient.para || 0
      const deliveryCount = Math.max(0, paraNum)
      if (prevPregnancies.length < deliveryCount) {
        for (let i = prevPregnancies.length; i < deliveryCount; i++) {
          prevPregnancies.push({
            pregnancyNumber: i + 1,
            outcome: PregnancyOutcome.LIVE_BIRTH,
            deliveryType: DeliveryType.NORMAL,
            babyGender: undefined,
          })
        }
      }
      setEditPreviousPregnancies(prevPregnancies.slice(0, deliveryCount))
      setShowEditModal(true)
    }
  }

  const updateEditPara = (newPara: number) => {
    setEditData({ ...editData, para: newPara })
    const deliveryCount = Math.max(0, newPara)
    setEditPreviousPregnancies(prev => {
      if (prev.length === deliveryCount) return prev
      if (prev.length < deliveryCount) {
        const newEntries: PreviousPregnancy[] = []
        for (let i = prev.length; i < deliveryCount; i++) {
          newEntries.push({
            pregnancyNumber: i + 1,
            outcome: PregnancyOutcome.LIVE_BIRTH,
            deliveryType: DeliveryType.NORMAL,
            babyGender: undefined,
          })
        }
        return [...prev, ...newEntries]
      }
      return prev.slice(0, deliveryCount)
    })
  }

  const updateEditPreviousPregnancy = (index: number, field: keyof PreviousPregnancy, value: string) => {
    setEditPreviousPregnancies(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleDelivery = (e: React.FormEvent) => {
    e.preventDefault()
    if (deliveryData.deliveryOutcome && deliveryData.deliveryType && deliveryData.deliveryDate) {
      deliveryMutation.mutate(deliveryData as DeliveryCompletionRequest)
    }
  }

  const handleScheduleConsultation = (e: React.FormEvent) => {
    e.preventDefault()
    if (consultationData.doctorId && consultationData.scheduledAt) {
      consultationMutation.mutate({
        patientId: patientId,
        doctorId: consultationData.doctorId,
        type: consultationData.type || ConsultationType.TELECONSULTATION,
        scheduledAt: consultationData.scheduledAt,
        chiefComplaint: consultationData.chiefComplaint,
        notes: consultationData.notes,
      })
    }
  }

  const getMinDateTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

  const canEdit = user?.role === UserRole.ADMIN || user?.role === UserRole.HELP_DESK
  const canDelete = user?.role === UserRole.ADMIN
  const canCompleteDelivery = user?.role === UserRole.ADMIN || user?.role === UserRole.MEDICAL_OFFICER || user?.role === UserRole.DOCTOR
  const isDeliveryPending = !patient?.deliveryOutcome || patient?.deliveryOutcome === DeliveryOutcome.PENDING

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Patient not found</p>
        <Button variant="secondary" onClick={() => navigate('/patients')} className="mt-4">
          Back to Patients
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="sm" onClick={() => navigate('/patients')}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
            <p className="text-gray-500">Mother ID: {patient.motherId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {patient.status === 'ACTIVE' && (
            <Button variant="secondary" onClick={() => setShowConsultationModal(true)}>
              <VideoCameraIcon className="h-5 w-5 mr-2" />
              Schedule Consultation
            </Button>
          )}
          {canCompleteDelivery && isDeliveryPending && patient.status === 'ACTIVE' && (
            <Button onClick={() => setShowDeliveryModal(true)}>
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              Mark Delivery Complete
            </Button>
          )}
          {canEdit && (
            <Button variant="secondary" onClick={openEditModal}>
              <PencilIcon className="h-5 w-5 mr-2" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              <TrashIcon className="h-5 w-5 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Patient Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader title="Basic Information" />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3">
              <RiskBadge level={patient.currentRiskLevel} />
              <PatientStatusBadge status={patient.status} />
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <IdentificationIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Aadhaar</p>
                  <p className="font-medium">{patient.aadhaarNumber}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <PhoneIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Mobile</p>
                  <p className="font-medium">{patient.mobileNumber}</p>
                  {patient.alternateMobile && (
                    <p className="text-sm text-gray-500">Alt: {patient.alternateMobile}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{patient.residence}</p>
                  {patient.village && <p className="text-sm text-gray-500">{patient.village}, {patient.mandal}</p>}
                  {patient.district && <p className="text-sm text-gray-500">{patient.district} - {patient.pincode}</p>}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CalendarIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Age</p>
                  <p className="font-medium">{patient.age} years</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Pregnancy Info */}
        <Card>
          <CardHeader title="Pregnancy Details" />
          <CardBody className="space-y-3">
            {patient.husbandName && (
              <div>
                <p className="text-sm text-gray-500">Husband's Name</p>
                <p className="font-medium">{patient.husbandName}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Gravida</p>
                <p className="font-medium">{patient.gravida || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Para</p>
                <p className="font-medium">{patient.para || '-'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">LMP Date</p>
              <p className="font-medium">
                {patient.lmpDate ? new Date(patient.lmpDate).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Expected Delivery Date</p>
              <p className="font-medium">
                {patient.eddDate ? new Date(patient.eddDate).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Blood Group</p>
              <p className="font-medium">{patient.bloodGroup || '-'}</p>
            </div>
          </CardBody>
        </Card>

        {/* Medical History */}
        <Card>
          <CardHeader title="Medical History" />
          <CardBody className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Previous Complications</p>
              <p className="font-medium">
                {patient.hasPreviousComplications ? 'Yes' : 'No'}
              </p>
              {patient.previousComplicationsDetails && (
                <p className="text-sm text-gray-600 mt-1">{patient.previousComplicationsDetails}</p>
              )}
            </div>

            {/* Previous Pregnancy Details - Show only when para >= 1 */}
            {patient.para && patient.para >= 1 && (
              <div className="border-t pt-3">
                <p className="text-sm text-gray-500 mb-2">Previous Pregnancy Types</p>
                <div className="flex flex-wrap gap-2">
                  {patient.hadNormalDelivery && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Normal Delivery
                    </span>
                  )}
                  {patient.hadCSectionDelivery && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      C-Section
                    </span>
                  )}
                  {patient.hadAbortion && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      Abortion
                    </span>
                  )}
                  {patient.hadOtherPregnancy && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Other: {patient.otherPregnancyDetails || 'N/A'}
                    </span>
                  )}
                  {!patient.hadNormalDelivery && !patient.hadCSectionDelivery && !patient.hadAbortion && !patient.hadOtherPregnancy && (
                    <span className="text-sm text-gray-500">Not specified</span>
                  )}
                </div>
                {patient.totalKidsBorn !== undefined && patient.totalKidsBorn !== null && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">Total Kids Born</p>
                    <p className="font-medium">{patient.totalKidsBorn}</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-sm text-gray-500">Medical History</p>
              <p className="font-medium">{patient.medicalHistory || 'None reported'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Allergies</p>
              <p className="font-medium">{patient.allergies || 'None reported'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Risk Score</p>
              <p className="font-medium">{patient.currentRiskScore}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Pregnancy Timeline - Show only for active patients without completed delivery */}
      {(!patient.deliveryOutcome || patient.deliveryOutcome === DeliveryOutcome.PENDING) && (
        <Card>
          <CardHeader title="Pregnancy Progress" />
          <CardBody className="p-0 sm:p-6">
            <PregnancyTimeline patient={patient} healthChecks={healthChecks} />
          </CardBody>
        </Card>
      )}

      {/* Delivery Information Card - Show if delivery completed */}
      {patient.deliveryOutcome && patient.deliveryOutcome !== DeliveryOutcome.PENDING && (
        <Card>
          <CardHeader
            title="Delivery Information"
            action={
              <Badge variant={patient.deliveryOutcome === DeliveryOutcome.SUCCESSFUL ? 'success' : 'danger'}>
                {patient.deliveryOutcome.replace('_', ' ')}
              </Badge>
            }
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Delivery Date</p>
                <p className="font-medium">
                  {patient.deliveryDate ? new Date(patient.deliveryDate).toLocaleDateString('en-IN') : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Delivery Type</p>
                <p className="font-medium">{patient.deliveryType || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Number of Babies</p>
                <p className="font-medium">{patient.numberOfBabies || 1}</p>
              </div>
              {patient.deliveryHospital && (
                <div>
                  <p className="text-sm text-gray-500">Hospital</p>
                  <p className="font-medium">{patient.deliveryHospital}</p>
                </div>
              )}
              {patient.deliveryNotes && (
                <div className="md:col-span-2 lg:col-span-4">
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="font-medium">{patient.deliveryNotes}</p>
                </div>
              )}
            </div>

            {/* Babies Information */}
            {patient.babies?.length ? (
              <div className="mt-4">
                <h4 className="font-medium text-gray-700 mb-3">
                  {patient.babies.length === 1 ? 'Baby Information' : 'Babies Information'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {patient.babies.map((baby, index) => (
                    <div
                      key={baby.id ?? baby.birthOrder ?? `${baby.gender || 'baby'}-${baby.weight ?? '0'}`}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        {patient.babies.length === 1 ? 'Baby' : `Child ${index + 1}`}
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Gender:</span>
                          <span className="text-sm font-medium">{baby.gender || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Weight:</span>
                          <span className="text-sm font-medium">{baby.weight ? `${baby.weight} kg` : '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Legacy single baby info (backward compatibility) */}
            {(!patient.babies || patient.babies.length === 0) && (patient.babyGender || patient.babyWeight) && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Baby Gender</p>
                  <p className="font-medium">{patient.babyGender || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Baby Weight</p>
                  <p className="font-medium">{patient.babyWeight ? `${patient.babyWeight} kg` : '-'}</p>
                </div>
              </div>
            )}

            {/* Mortality Info */}
            {(patient.deliveryOutcome === DeliveryOutcome.MOTHER_MORTALITY ||
              patient.deliveryOutcome === DeliveryOutcome.BABY_MORTALITY ||
              patient.deliveryOutcome === DeliveryOutcome.BOTH_MORTALITY) && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-800 mb-2">Mortality Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-red-600">Date</p>
                    <p className="font-medium text-red-800">
                      {patient.mortalityDate ? new Date(patient.mortalityDate).toLocaleDateString('en-IN') : '-'}
                    </p>
                  </div>
                  {patient.mortalityCause && (
                    <div>
                      <p className="text-sm text-red-600">Cause</p>
                      <p className="font-medium text-red-800">{patient.mortalityCause}</p>
                    </div>
                  )}
                  {patient.mortalityNotes && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-red-600">Notes</p>
                      <p className="font-medium text-red-800">{patient.mortalityNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Patient Timeline */}
      <Card>
        <CardHeader
          title="Patient Timeline"
          subtitle="Complete history of patient interactions"
        />
        <CardBody>
          <PatientTimeline
            patient={patient}
            healthChecks={healthChecks}
            consultations={consultations}
            followUps={followUps}
            alerts={alerts}
          />
        </CardBody>
      </Card>

      {/* Health Checks */}
      <Card>
        <CardHeader
          title="Recent Health Checks"
          subtitle={`${healthChecks?.length || 0} health checks recorded`}
        />
        <CardBody className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell header>Date</TableCell>
                <TableCell header>BP</TableCell>
                <TableCell header>Weight</TableCell>
                <TableCell header>Hemoglobin</TableCell>
                <TableCell header>Risk Level</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {healthChecks && healthChecks.length > 0 ? (
                healthChecks.slice(0, 5).map((hc) => (
                  <TableRow key={hc.id}>
                    <TableCell>{new Date(hc.checkDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {hc.bpSystolic && hc.bpDiastolic
                        ? `${hc.bpSystolic}/${hc.bpDiastolic}`
                        : '-'}
                    </TableCell>
                    <TableCell>{hc.weight ? `${hc.weight} kg` : '-'}</TableCell>
                    <TableCell>{hc.hemoglobin ? `${hc.hemoglobin} g/dL` : '-'}</TableCell>
                    <TableCell>
                      <RiskBadge level={hc.riskLevel} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty title="No health checks" description="No health checks recorded yet" />
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Consultation History */}
      <Card>
        <CardHeader
          title="Consultation History"
          subtitle={`${consultations?.length || 0} consultations`}
          action={
            patient.status === 'ACTIVE' && (
              <Button size="sm" onClick={() => setShowConsultationModal(true)}>
                <VideoCameraIcon className="h-4 w-4 mr-1" />
                Schedule
              </Button>
            )
          }
        />
        <CardBody className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell header>Date</TableCell>
                <TableCell header>Doctor</TableCell>
                <TableCell header>Type</TableCell>
                <TableCell header>Status</TableCell>
                <TableCell header>Chief Complaint</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {consultations && consultations.length > 0 ? (
                consultations.slice(0, 10).map((consultation) => (
                  <TableRow key={consultation.id}>
                    <TableCell>
                      {new Date(consultation.scheduledAt).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">Dr. {consultation.doctor.name}</p>
                        <p className="text-sm text-gray-500">{consultation.doctor.designation || consultation.doctor.department}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={consultation.type === ConsultationType.TELECONSULTATION ? 'info' : consultation.type === ConsultationType.EMERGENCY ? 'danger' : 'default'}>
                        {consultation.type === ConsultationType.TELECONSULTATION && <VideoCameraIcon className="h-3 w-3 mr-1" />}
                        {consultation.type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ConsultationStatusBadge status={consultation.status} />
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-gray-600 truncate max-w-xs">
                        {consultation.chiefComplaint || '-'}
                      </p>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty
                  title="No consultations"
                  description="No consultations scheduled for this patient"
                  action={
                    patient.status === 'ACTIVE' && (
                      <Button size="sm" onClick={() => setShowConsultationModal(true)}>
                        <VideoCameraIcon className="h-4 w-4 mr-1" />
                        Schedule Consultation
                      </Button>
                    )
                  }
                />
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader
          title="Risk Alerts"
          subtitle={`${alerts?.length || 0} alerts`}
        />
        <CardBody className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell header>Severity</TableCell>
                <TableCell header>Alert</TableCell>
                <TableCell header>Created</TableCell>
                <TableCell header>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts && alerts.length > 0 ? (
                alerts.slice(0, 5).map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <RiskBadge level={alert.severity} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {alert.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(alert.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {alert.isAcknowledged ? (
                        <Badge variant="success">Acknowledged</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty title="No alerts" description="No risk alerts for this patient" />
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Patient"
        size="lg"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input
                type="text"
                required
                className="input"
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Age *</label>
              <input
                type="number"
                required
                className="input"
                value={editData.age || ''}
                onChange={(e) => setEditData({ ...editData, age: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="label">Husband's Name</label>
            <input
              type="text"
              className="input"
              value={editData.husbandName || ''}
              onChange={(e) => setEditData({ ...editData, husbandName: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Residence *</label>
            <textarea
              required
              className="input"
              rows={2}
              value={editData.residence || ''}
              onChange={(e) => setEditData({ ...editData, residence: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Mobile Number *</label>
              <input
                type="tel"
                required
                className="input"
                value={editData.mobileNumber || ''}
                onChange={(e) => setEditData({ ...editData, mobileNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Alternate Mobile</label>
              <input
                type="tel"
                className="input"
                value={editData.alternateMobile || ''}
                onChange={(e) => setEditData({ ...editData, alternateMobile: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email (Optional)</label>
              <input
                type="email"
                className="input"
                placeholder="email@example.com"
                value={editData.email || ''}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              />
            </div>
          </div>

          {/* Address Details */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Address Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">District</label>
                <input
                  type="text"
                  className="input"
                  value={editData.district || ''}
                  onChange={(e) => setEditData({ ...editData, district: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Mandal</label>
                <input
                  type="text"
                  className="input"
                  value={editData.mandal || ''}
                  onChange={(e) => setEditData({ ...editData, mandal: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Village</label>
                <input
                  type="text"
                  className="input"
                  value={editData.village || ''}
                  onChange={(e) => setEditData({ ...editData, village: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input
                  type="text"
                  className="input"
                  maxLength={6}
                  value={editData.pincode || ''}
                  onChange={(e) => setEditData({ ...editData, pincode: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Pregnancy Information */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Pregnancy Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">LMP Date</label>
                <input
                  type="date"
                  className="input"
                  value={editData.lmpDate || ''}
                  onChange={(e) => setEditData({ ...editData, lmpDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Blood Group</label>
                <select
                  className="input"
                  value={editData.bloodGroup || ''}
                  onChange={(e) => setEditData({ ...editData, bloodGroup: e.target.value })}
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label className="label">Gravida (No. of Pregnancies incl. current)</label>
                <select
                  className="input"
                  value={editData.gravida || ''}
                  onChange={(e) => setEditData({ ...editData, gravida: parseInt(e.target.value) || undefined })}
                >
                  <option value="">Select</option>
                  {PREGNANCY_COUNT_OPTIONS.map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Para (No. of Deliveries)</label>
                <select
                  className="input"
                  value={editData.para || ''}
                  onChange={(e) => updateEditPara(parseInt(e.target.value) || 0)}
                >
                  <option value="">Select</option>
                  {PREGNANCY_COUNT_OPTIONS.map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dynamic Previous Delivery Details */}
            {editPreviousPregnancies.length > 0 && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h5 className="text-sm font-medium text-purple-900 mb-4">
                  Previous Delivery Details ({editPreviousPregnancies.length} {editPreviousPregnancies.length === 1 ? 'delivery' : 'deliveries'})
                </h5>
                <div className="space-y-4">
                  {editPreviousPregnancies.map((pregnancy, index) => (
                    <div key={index} className="p-3 bg-white rounded-lg border border-purple-100">
                      <p className="text-sm font-medium text-purple-800 mb-3">
                        Delivery #{pregnancy.pregnancyNumber}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="label text-xs">Outcome</label>
                          <select
                            value={pregnancy.outcome}
                            onChange={(e) => updateEditPreviousPregnancy(index, 'outcome', e.target.value)}
                            className="input text-sm"
                          >
                            {PREGNANCY_OUTCOME_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>

                        {pregnancy.outcome === 'LIVE_BIRTH' && (
                          <>
                            <div>
                              <label className="label text-xs">Delivery Type</label>
                              <select
                                value={pregnancy.deliveryType || ''}
                                onChange={(e) => updateEditPreviousPregnancy(index, 'deliveryType', e.target.value)}
                                className="input text-sm"
                              >
                                <option value="">Select</option>
                                {PREVIOUS_DELIVERY_TYPE_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label text-xs">Baby Gender</label>
                              <select
                                value={pregnancy.babyGender || ''}
                                onChange={(e) => updateEditPreviousPregnancy(index, 'babyGender', e.target.value)}
                                className="input text-sm"
                              >
                                <option value="">Select</option>
                                {BABY_GENDER_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Previous Complications */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Previous Complications & Medical History</h4>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasPreviousComplications"
                  className="w-4 h-4 text-blue-600 rounded"
                  checked={editData.hasPreviousComplications || false}
                  onChange={(e) => setEditData({ ...editData, hasPreviousComplications: e.target.checked })}
                />
                <label htmlFor="hasPreviousComplications" className="text-sm text-gray-700">
                  Has Previous Complications
                </label>
              </div>

              {editData.hasPreviousComplications && (
                <div>
                  <label className="label">Previous Complications Details</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Describe previous complications..."
                    value={editData.previousComplicationsDetails || ''}
                    onChange={(e) => setEditData({ ...editData, previousComplicationsDetails: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="label">Medical History</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Any existing medical conditions..."
                  value={editData.medicalHistory || ''}
                  onChange={(e) => setEditData({ ...editData, medicalHistory: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Allergies</label>
                <input
                  type="text"
                  className="input"
                  placeholder="List any known allergies..."
                  value={editData.allergies || ''}
                  onChange={(e) => setEditData({ ...editData, allergies: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Patient"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{patient.name}</strong>?
          </p>
          <p className="text-sm text-red-600">
            This will permanently delete all associated health checks, alerts, and records. This action cannot be undone.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Delete Patient
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delivery Completion Modal */}
      <Modal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        title="Mark Delivery Complete"
        size="lg"
        animation="flip"
      >
        <form onSubmit={handleDelivery} className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg mb-4">
            <p className="text-sm text-blue-800">
              Recording delivery completion for <strong>{patient.name}</strong> (Mother ID: {patient.motherId})
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Delivery Outcome *"
              options={DELIVERY_OUTCOMES}
              value={deliveryData.deliveryOutcome}
              onChange={(e) => setDeliveryData({ ...deliveryData, deliveryOutcome: e.target.value as DeliveryOutcome })}
              required
            />
            <Select
              label="Delivery Type *"
              options={DELIVERY_TYPES}
              value={deliveryData.deliveryType}
              onChange={(e) => setDeliveryData({ ...deliveryData, deliveryType: e.target.value as DeliveryType })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Delivery Date *"
              type="date"
              required
              max={new Date().toISOString().split('T')[0]}
              value={deliveryData.deliveryDate || ''}
              onChange={(e) => setDeliveryData({ ...deliveryData, deliveryDate: e.target.value })}
            />
            <Input
              label="Hospital/Facility"
              value={deliveryData.deliveryHospital || ''}
              onChange={(e) => setDeliveryData({ ...deliveryData, deliveryHospital: e.target.value })}
            />
          </div>

          {/* Number of Babies - Show only for successful delivery or baby mortality */}
          {deliveryData.deliveryOutcome !== DeliveryOutcome.MOTHER_MORTALITY && (
            <>
              <div>
                <Select
                  label="Number of Babies Delivered *"
                  options={[
                    { value: '1', label: '1 (Single)' },
                    { value: '2', label: '2 (Twins)' },
                    { value: '3', label: '3 (Triplets)' },
                    { value: '4', label: '4 (Quadruplets)' },
                  ]}
                  value={deliveryData.numberOfBabies?.toString() || '1'}
                  onChange={(e) => {
                    const count = parseInt(e.target.value)
                    const newBabies = Array.from({ length: count }, (_, i) => ({
                      gender: deliveryData.babies?.[i]?.gender || '',
                      weight: deliveryData.babies?.[i]?.weight || undefined,
                      birthOrder: i + 1,
                    }))
                    setDeliveryData({ 
                      ...deliveryData, 
                      numberOfBabies: count,
                      babies: newBabies,
                    })
                  }}
                  required
                />
              </div>

              {/* Dynamic Baby Information Fields */}
              {deliveryData.babies?.map((baby, index) => (
                <div key={baby.birthOrder} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-700 mb-3">
                    {deliveryData.numberOfBabies === 1 ? 'Baby Information' : `Child ${index + 1}`}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Gender"
                      options={[
                        { value: 'Male', label: 'Male' },
                        { value: 'Female', label: 'Female' },
                      ]}
                      value={baby.gender || ''}
                      onChange={(e) => {
                        const newBabies = [...(deliveryData.babies || [])]
                        newBabies[index] = { ...newBabies[index], gender: e.target.value }
                        setDeliveryData({ ...deliveryData, babies: newBabies })
                      }}
                      placeholder="Select gender"
                      required
                    />
                    <Input
                      label="Weight (kg)"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={baby.weight || ''}
                      onChange={(e) => {
                        const newBabies = [...(deliveryData.babies || [])]
                        newBabies[index] = { ...newBabies[index], weight: parseFloat(e.target.value) || undefined }
                        setDeliveryData({ ...deliveryData, babies: newBabies })
                      }}
                      placeholder="e.g., 3.2"
                      required
                    />
                  </div>
                </div>
              ))}
            </>
          )}

          <div>
            <label className="label">Delivery Notes</label>
            <textarea
              className="input"
              rows={2}
              value={deliveryData.deliveryNotes || ''}
              onChange={(e) => setDeliveryData({ ...deliveryData, deliveryNotes: e.target.value })}
              placeholder="Any observations or notes about the delivery..."
            />
          </div>

          {/* Mortality Information - Show if outcome involves mortality */}
          {deliveryData.deliveryOutcome && deliveryData.deliveryOutcome !== DeliveryOutcome.SUCCESSFUL && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200 space-y-4">
              <h4 className="font-medium text-red-800">Mortality Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Mortality Date *"
                  type="date"
                  required
                  max={new Date().toISOString().split('T')[0]}
                  value={deliveryData.mortalityDate || ''}
                  onChange={(e) => setDeliveryData({ ...deliveryData, mortalityDate: e.target.value })}
                />
                <Input
                  label="Cause of Death"
                  value={deliveryData.mortalityCause || ''}
                  onChange={(e) => setDeliveryData({ ...deliveryData, mortalityCause: e.target.value })}
                  placeholder="e.g., Hemorrhage, Infection..."
                />
              </div>
              <div>
                <label className="label">Mortality Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  value={deliveryData.mortalityNotes || ''}
                  onChange={(e) => setDeliveryData({ ...deliveryData, mortalityNotes: e.target.value })}
                  placeholder="Additional details about the mortality..."
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setShowDeliveryModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={deliveryMutation.isPending}>
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              Record Delivery
            </Button>
          </div>
        </form>
      </Modal>

      {/* Schedule Consultation Modal */}
      <Modal
        isOpen={showConsultationModal}
        onClose={() => setShowConsultationModal(false)}
        title="Schedule Consultation"
        size="md"
        animation="flip"
      >
        <form onSubmit={handleScheduleConsultation} className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg mb-4">
            <p className="text-sm text-blue-800">
              Scheduling consultation for <strong>{patient.name}</strong> (Mother ID: {patient.motherId})
            </p>
          </div>

          <Select
            label="Select Doctor *"
            options={
              doctors?.map((doc: User) => ({
                value: doc.id.toString(),
                label: `Dr. ${doc.name} - ${doc.designation || doc.department || 'General'}`,
              })) || []
            }
            value={consultationData.doctorId?.toString() || ''}
            onChange={(e) => setConsultationData({ ...consultationData, doctorId: parseInt(e.target.value) })}
            required
            placeholder="Select a doctor"
          />

          <Select
            label="Consultation Type *"
            options={[
              { value: ConsultationType.TELECONSULTATION, label: 'Teleconsultation (Video Call)' },
              { value: ConsultationType.IN_PERSON, label: 'In-Person Consultation' },
              { value: ConsultationType.EMERGENCY, label: 'Emergency Consultation' },
            ]}
            value={consultationData.type}
            onChange={(e) => setConsultationData({ ...consultationData, type: e.target.value as ConsultationType })}
            required
          />

          <Input
            label="Scheduled Date & Time *"
            type="datetime-local"
            required
            min={getMinDateTime()}
            value={consultationData.scheduledAt || ''}
            onChange={(e) => setConsultationData({ ...consultationData, scheduledAt: e.target.value })}
          />

          <div>
            <label className="label">Chief Complaint</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Describe the reason for consultation..."
              value={consultationData.chiefComplaint || ''}
              onChange={(e) => setConsultationData({ ...consultationData, chiefComplaint: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Additional Notes</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Any additional notes for the doctor..."
              value={consultationData.notes || ''}
              onChange={(e) => setConsultationData({ ...consultationData, notes: e.target.value })}
            />
          </div>

          {consultationData.type === ConsultationType.TELECONSULTATION && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <VideoCameraIcon className="h-4 w-4 inline mr-1" />
                A video room link will be generated automatically for teleconsultation.
              </p>
            </div>
          )}

          {consultationData.type === ConsultationType.EMERGENCY && (
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800">
                Emergency consultations will be prioritized and doctors will be notified immediately.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setShowConsultationModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={consultationMutation.isPending} disabled={!consultationData.doctorId || !consultationData.scheduledAt}>
              <CalendarIcon className="h-5 w-5 mr-2" />
              Schedule Consultation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

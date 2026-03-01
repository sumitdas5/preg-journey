import { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon, ArrowUpTrayIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty,
  TableLoading,
  RiskBadge,
  PatientStatusBadge,
  Modal,
} from '@/components/ui'
import { patientService, BulkUploadResult } from '@/services'
import { RiskLevel } from '@/types'
import PatientRegistrationForm from '@/components/patient/PatientRegistrationForm'
import toast from 'react-hot-toast'

export default function Patients() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const riskFilter = searchParams.get('risk') as RiskLevel | null
  const page = parseInt(searchParams.get('page') || '0')

  const { data: patients, isLoading, refetch } = useQuery({
    queryKey: ['patients', page, riskFilter, searchQuery],
    queryFn: () => {
      if (searchQuery) {
        return patientService.search(searchQuery, page)
      }
      if (riskFilter) {
        return patientService.getByRiskLevel(riskFilter, page)
      }
      return patientService.getAll(page)
    },
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    refetch()
  }

  const handleRiskFilter = (risk: RiskLevel | null) => {
    const params = Object.fromEntries(searchParams)
    if (risk) {
      params.risk = risk
    } else {
      delete params.risk
    }
    params.page = '0' // Reset to first page when filter changes
    setSearchParams(params)
  }

  const handleRegistrationSuccess = () => {
    setShowRegisterModal(false)
    refetch()
  }

  const bulkUploadMutation = useMutation({
    mutationFn: (file: File) => patientService.bulkUpload(file),
    onSuccess: (result) => {
      setUploadResult(result)
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success(`Successfully uploaded ${result.successCount} patients`)
    },
    onError: () => {
      toast.error('Failed to upload file')
    },
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      bulkUploadMutation.mutate(file)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const blob = await patientService.downloadTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'patient_registration_template.xlsx'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Template downloaded')
    } catch {
      toast.error('Failed to download template')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500">Manage and monitor registered patients</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowBulkUploadModal(true)}>
            <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={() => setShowRegisterModal(true)}>
            <PlusIcon className="h-5 w-5 mr-2" />
            Register Patient
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, Mother ID, mobile..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </form>

            {/* Risk Filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={riskFilter || ''}
                onChange={(e) => handleRiskFilter(e.target.value as RiskLevel || null)}
                className="input w-40"
              >
                <option value="">All Risk Levels</option>
                <option value={RiskLevel.RED}>Severe (RED)</option>
                <option value={RiskLevel.YELLOW}>Moderate (YELLOW)</option>
                <option value={RiskLevel.GREEN}>Stable (GREEN)</option>
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardHeader
          title={`Patients (${patients?.totalElements || 0})`}
          subtitle="Click on a patient to view details"
        />
        <CardBody className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell header>Patient</TableCell>
                <TableCell header>Mother ID</TableCell>
                <TableCell header>Age</TableCell>
                <TableCell header>Mobile</TableCell>
                <TableCell header>Risk Level</TableCell>
                <TableCell header>Status</TableCell>
                <TableCell header>Registered</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableLoading columns={7} />
              ) : patients?.content && patients.content.length > 0 ? (
                patients.content.map((patient) => (
                  <TableRow
                    key={patient.id}
                    onClick={() => navigate(`/patients/${patient.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{patient.name}</p>
                        {patient.husbandName && (
                          <p className="text-sm text-gray-500">W/O {patient.husbandName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{patient.motherId}</span>
                    </TableCell>
                    <TableCell>{patient.age} yrs</TableCell>
                    <TableCell>{patient.mobileNumber}</TableCell>
                    <TableCell>
                      <RiskBadge level={patient.currentRiskLevel} />
                    </TableCell>
                    <TableCell>
                      <PatientStatusBadge status={patient.status} />
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {new Date(patient.registrationDate).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty
                  title="No patients found"
                  description={searchQuery ? 'Try adjusting your search' : 'Start by registering a new patient'}
                  action={
                    <Button onClick={() => setShowRegisterModal(true)}>
                      <PlusIcon className="h-5 w-5 mr-2" />
                      Register Patient
                    </Button>
                  }
                />
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {patients && patients.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {patients.number * patients.size + 1} to{' '}
                {Math.min((patients.number + 1) * patients.size, patients.totalElements)} of{' '}
                {patients.totalElements} patients
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={patients.first}
                  onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={patients.last}
                  onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) })}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Registration Modal */}
      <Modal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="Register New Patient"
        size="xl"
      >
        <PatientRegistrationForm onSuccess={handleRegistrationSuccess} />
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal
        isOpen={showBulkUploadModal}
        onClose={() => {
          setShowBulkUploadModal(false)
          setUploadResult(null)
        }}
        title="Bulk Upload Patients"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Upload an Excel file (.xlsx) with patient data. Download the template to see the required format.
          </p>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleDownloadTemplate}>
              <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
              Download Template
            </Button>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              <button
                type="button"
                className="text-blue-600 hover:text-blue-500 font-medium"
                onClick={() => fileInputRef.current?.click()}
              >
                Click to upload
              </button>{' '}
              or drag and drop
            </p>
            <p className="mt-1 text-xs text-gray-500">Excel files only (.xlsx, .xls)</p>
          </div>

          {bulkUploadMutation.isPending && (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              Processing file...
            </div>
          )}

          {uploadResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900">{uploadResult.totalRecords}</p>
                  <p className="text-sm text-gray-500">Total Records</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{uploadResult.successCount}</p>
                  <p className="text-sm text-green-700">Successful</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{uploadResult.failureCount}</p>
                  <p className="text-sm text-red-700">Failed</p>
                </div>
              </div>

              {uploadResult.failedRecords.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-800 mb-2">Failed Records:</h4>
                  <div className="bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {uploadResult.failedRecords.map((record, idx) => (
                      <div key={idx} className="text-sm text-red-700 py-1">
                        Row {record.rowNumber}: {record.name || 'Unknown'} - {record.errorMessage}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadResult.successfulRecords.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-800 mb-2">Successfully Registered:</h4>
                  <div className="bg-green-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {uploadResult.successfulRecords.slice(0, 10).map((record, idx) => (
                      <div key={idx} className="text-sm text-green-700 py-1">
                        {record.name} - Mother ID: {record.motherId}
                      </div>
                    ))}
                    {uploadResult.successfulRecords.length > 10 && (
                      <div className="text-sm text-green-600 font-medium">
                        ...and {uploadResult.successfulRecords.length - 10} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowBulkUploadModal(false)
                setUploadResult(null)
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

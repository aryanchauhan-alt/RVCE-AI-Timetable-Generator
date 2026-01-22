
import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Filter,
  Download,
  DoorOpen,
  Users,
  Building2,
  FlaskConical,
  X,
  Trash2,
  Calendar,
  Eye,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://rvce-ai-timetable-generator.onrender.com'
const LOCAL_STORAGE_KEY = 'rvce_timetable_changes'
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TIME_SLOTS = [
  { id: 1, time: '9:00-10:00' },
  { id: 2, time: '10:00-11:00' },
  { id: 3, time: '11:30-12:30' },
  { id: 4, time: '12:30-1:30' },
  { id: 5, time: '2:30-3:30' },
  { id: 6, time: '3:30-4:30' },
]

export default function RoomsManage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedDept, setSelectedDept] = useState('all')
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [allTimetables, setAllTimetables] = useState({})
  const [sections, setSections] = useState([])

  // Local changes and save state
  const [localChanges, setLocalChanges] = useState([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetchData()
    loadLocalChanges()
  }, [])

  const loadLocalChanges = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (saved) {
        const changes = JSON.parse(saved)
        setLocalChanges(changes)
        setHasUnsavedChanges(changes.length > 0)
      }
    } catch (err) { console.error(err) }
  }

  const saveLocalChanges = useCallback((changes) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(changes))
      setLocalChanges(changes)
      setHasUnsavedChanges(changes.length > 0)
      setRefreshKey(prev => prev + 1)
    } catch (err) { console.error(err) }
  }, [])

  async function fetchData() {
    try {
      const [roomsRes, allRes, sectionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/timetable/rooms`),
        fetch(`${API_BASE}/api/timetable/all`),
        fetch(`${API_BASE}/api/timetable/sections`)
      ])

      const roomsData = await roomsRes.json()
      const allData = await allRes.json()
      const sectionsData = await sectionsRes.json()

      setRooms(roomsData.rooms || [])
      // allData.sections is a dict with section IDs as keys
      setAllTimetables(allData.sections || {})
      setSections(sectionsData.sections || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get room schedule from all timetables
  const getRoomSchedule = useCallback((roomId) => {
    const schedule = []

    // Also check local storage for removed classes
    const removedSlots = localChanges.filter(c => c.type === 'unassigned')

    Object.entries(allTimetables).forEach(([sectionId, sectionData]) => {
      const slots = sectionData.slots || []
      const info = sectionData.info || {}

      slots.forEach(entry => {
        // Check room.name matches roomId
        if (entry.room?.name === roomId) {
          // Check if this slot was removed
          const isRemoved = removedSlots.some(r =>
            String(r.section_id) === String(sectionId) &&
            r.day?.toUpperCase() === entry.day_name?.toUpperCase() &&
            r.slot === entry.slot
          )

          if (!isRemoved) {
            schedule.push({
              ...entry,
              section_id: sectionId,
              section_name: info.department ? `${info.department} ${info.section} (Sem ${info.semester})` : `Section ${sectionId}`
            })
          }
        }
      })
    })

    return schedule
  }, [allTimetables, localChanges, refreshKey])

  // Build schedule grid for modal
  const buildScheduleGrid = (roomId) => {
    const schedule = getRoomSchedule(roomId)
    const grid = {}

    DAYS.forEach(day => {
      grid[day] = {}
      TIME_SLOTS.forEach(slot => {
        grid[day][slot.id] = null
      })
    })

    schedule.forEach(entry => {
      // Use day_name from the entry
      const dayName = entry.day_name
      if (grid[dayName] && grid[dayName][entry.slot] !== undefined) {
        grid[dayName][entry.slot] = entry
      }
    })

    return grid
  }

  // Open room schedule modal
  const openRoomSchedule = (room) => {
    setSelectedRoom(room)
    setShowScheduleModal(true)
  }

  // Remove class from room schedule
  const removeClassFromSchedule = (sectionId, dayName, slot, entry) => {
    const newChange = {
      id: `${sectionId}-${dayName?.toUpperCase()}-${slot}`,
      type: 'unassigned',
      section_id: sectionId,
      day: dayName?.toUpperCase(),
      slot,
      reason: `Removed from room ${selectedRoom?.id}`,
      originalData: entry,
      timestamp: new Date().toISOString()
    }

    const existing = localChanges.filter(c => c.id !== newChange.id)
    saveLocalChanges([...existing, newChange])

    setSaveMessage({ type: 'info', text: 'Class removed - click Save Changes to apply permanently' })
    setTimeout(() => setSaveMessage(null), 3000)
  }

  // Save changes to backend
  const handleSaveChanges = async () => {
    if (localChanges.length === 0) return

    setSaving(true)
    try {
      // Group changes by section
      const changesBySection = {}
      localChanges.forEach(change => {
        if (!changesBySection[change.section_id]) {
          changesBySection[change.section_id] = []
        }
        changesBySection[change.section_id].push(change)
      })

      // Apply changes to each section
      for (const [sectionId, changes] of Object.entries(changesBySection)) {
        // Get current timetable for this section
        const sectionData = allTimetables[sectionId]
        if (!sectionData) continue

        // Update slots - keep the slot but remove room/faculty assignment for unassigned slots
        const updatedSlots = (sectionData.slots || []).map(slot => {
          const isUnassigned = changes.some(c =>
            c.type === 'unassigned' &&
            c.day?.toUpperCase() === slot.day_name?.toUpperCase() &&
            c.slot === slot.slot
          )

          if (isUnassigned) {
            // Keep the slot but mark as needing reassignment
            return {
              day_name: slot.day_name,
              slot: slot.slot,
              subject: slot.subject,
              faculty: { id: null, name: 'TBA' },
              room: { name: 'TBD' },
              is_lab: slot.is_lab,
              needs_assignment: true
            }
          }
          return {
            day_name: slot.day_name,
            slot: slot.slot,
            subject: slot.subject,
            faculty: slot.faculty,
            room: slot.room,
            is_lab: slot.is_lab
          }
        })

        // Send to backend
        await fetch(`${API_BASE}/api/timetable/manual-edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: parseInt(sectionId),
            changes: [],
            timetable: updatedSlots
          })
        })
      }

      // DON'T clear localStorage - keep unassigned notifications visible in ManageTimetable
      setHasUnsavedChanges(false)

      // Refresh data from backend
      await fetchData()

      setSaveMessage({ type: 'success', text: 'Changes saved! Unassigned slots will appear in Manage Timetable.' })
      setTimeout(() => setSaveMessage(null), 4000)
    } catch (error) {
      console.error('Error saving changes:', error)
      setSaveMessage({ type: 'error', text: 'Failed to save changes' })
      setTimeout(() => setSaveMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch = r.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = selectedType === 'all' || r.room_type === selectedType
    const matchesDept = selectedDept === 'all' || r.department === selectedDept
    return matchesSearch && matchesType && matchesDept
  })

  // Get unique types and departments
  const uniqueTypes = [...new Set(rooms.map(r => r.room_type))].filter(Boolean).sort()
  const uniqueDepts = [...new Set(rooms.map(r => r.department))].filter(Boolean).sort()

  // Stats
  const totalRooms = rooms.length
  const totalCapacity = rooms.reduce((sum, r) => sum + (r.capacity || 0), 0)
  const lectureRooms = rooms.filter(r => r.room_type?.toLowerCase().includes('lecture') || r.room_type?.toLowerCase().includes('classroom')).length
  const labs = rooms.filter(r => r.room_type?.toLowerCase().includes('lab')).length

  const getTypeColor = (type) => {
    const t = type?.toLowerCase() || ''
    if (t.includes('lab')) return 'bg-purple-50 text-purple-700 border-purple-200'
    if (t.includes('lecture')) return 'bg-blue-50 text-blue-700 border-blue-200'
    if (t.includes('classroom')) return 'bg-green-50 text-green-700 border-green-200'
    return 'bg-gray-50 text-gray-700 border-gray-200'
  }

  const exportToCSV = () => {
    const headers = ['Room ID', 'Department', 'Room Type', 'Capacity']
    const rows = filteredRooms.map(r => [
      r.id,
      r.department,
      r.room_type,
      r.capacity
    ])

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rooms_data.csv'
    a.click()
  }

  return (
    <AppShell title="Rooms Management">
      <div className="space-y-6">
        {/* Save Message Toast */}
        {saveMessage && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${saveMessage.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' :
            saveMessage.type === 'error' ? 'bg-red-100 text-red-800 border border-red-300' :
              'bg-blue-100 text-blue-800 border border-blue-300'
            }`}>
            {saveMessage.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
            {saveMessage.type === 'error' && <AlertCircle className="w-5 h-5" />}
            {saveMessage.type === 'info' && <AlertCircle className="w-5 h-5" />}
            {saveMessage.text}
          </div>
        )}


        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex flex-1 gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[150px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Room Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="w-[150px]">
                <Building2 className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Depts</SelectItem>
                {uniqueDepts.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            {hasUnsavedChanges && (
              <Button onClick={handleSaveChanges} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes ({localChanges.length})
              </Button>
            )}
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Unsaved Changes Banner */}
        {hasUnsavedChanges && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">You have {localChanges.length} unsaved change(s)</p>
                <p className="text-sm text-amber-600">Click "Save Changes" to apply them permanently to the timetable.</p>
              </div>
            </div>
            <Button onClick={handleSaveChanges} disabled={saving} size="sm" className="bg-amber-600 hover:bg-amber-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Now
            </Button>
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Room Schedule Management</p>
              <p className="text-sm text-blue-700 mt-1">
                Click on any room row or use the "View Schedule" button to see its weekly schedule.
                You can remove classes from the schedule - they will appear as unassigned in the Manage Timetable page.
              </p>
            </div>
          </div>
        </div>

        {/* Rooms Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="w-5 h-5" />
              Rooms List ({filteredRooms.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-accent-navy text-white">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Room Details</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Type</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Capacity</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Classes</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRooms.map((r, idx) => {
                      const classCount = getRoomSchedule(r.id).length;
                      return (
                        <motion.tr
                          key={r.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.01 }}
                          className="hover:bg-bg-secondary/50 transition-colors"
                          onClick={() => openRoomSchedule(r)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${r.room_type === 'Lab' ? 'bg-emerald-50 text-emerald-700' : 'bg-bg-secondary text-accent-navy'
                                }`}>
                                {r.id.substring(0, 2)}
                              </div>
                              <div>
                                <p className="font-semibold text-accent-navy">{r.id}</p>
                                <p className="text-sm text-text-secondary">{r.department}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={getTypeColor(r.room_type)}>
                              {r.room_type}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-medium">{r.capacity}</span>
                            <span className="text-gray-400 text-sm ml-1">seats</span>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="secondary">
                              {classCount} classes/week
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-accent-navy hover:text-navy hover:bg-navy/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRoomSchedule(r);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Room Schedule Modal */}
      {showScheduleModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedRoom.id} - Schedule</h2>
                <p className="text-blue-100 text-sm">
                  {selectedRoom.department} • {selectedRoom.room_type} • {selectedRoom.capacity} seats
                </p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Schedule Grid */}
            <div className="p-4 overflow-auto max-h-[calc(90vh-120px)]">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-orange-800">
                  <strong>Tip:</strong> Click the trash icon on any class to remove it from this room.
                  The class will appear as "Unassigned" in the Manage Timetable page.
                </p>
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border bg-gray-100 p-2 text-sm font-medium w-24">Day</th>
                    {TIME_SLOTS.map(slot => (
                      <th key={slot.id} className="border bg-gray-100 p-2 text-sm font-medium">
                        {slot.time}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => {
                    const grid = buildScheduleGrid(selectedRoom.id)
                    return (
                      <tr key={day}>
                        <td className="border bg-gray-50 p-2 font-medium text-sm">{day}</td>
                        {TIME_SLOTS.map(slot => {
                          const entry = grid[day]?.[slot.id]
                          return (
                            <td key={slot.id} className="border p-1 min-w-[120px]">
                              {entry ? (
                                <div className={`${entry.is_lab ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'} border rounded p-2 text-xs relative group`}>
                                  <div className="font-semibold text-gray-800 pr-6 text-[10px] leading-tight">
                                    {entry.subject?.name || entry.subject?.course_code || 'Subject'}
                                  </div>
                                  <div className="text-purple-700 mt-1 text-[9px] font-medium">
                                    {entry.faculty?.name || 'TBA'}
                                  </div>
                                  <div className="text-gray-500 mt-0.5 text-[9px]">
                                    {entry.section_name || entry.section_id}
                                  </div>
                                  {entry.is_lab && <div className="text-green-700 font-bold text-[8px] mt-0.5">LAB</div>}
                                  <button
                                    onClick={() => removeClassFromSchedule(
                                      entry.section_id,
                                      entry.day_name,
                                      entry.slot,
                                      entry
                                    )}
                                    className="absolute top-1 right-1 p-1 rounded bg-red-100 text-red-600 
                                             opacity-0 group-hover:opacity-100 hover:bg-red-200 transition-all"
                                    title="Remove from schedule"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="h-16 bg-gray-50 rounded flex items-center justify-center text-gray-400 text-xs">
                                  Available
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Summary */}
              <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
                <span>
                  <strong>{getRoomSchedule(selectedRoom.id).length}</strong> classes scheduled
                </span>
                <span>•</span>
                <span>
                  <strong>{36 - getRoomSchedule(selectedRoom.id).length}</strong> slots available
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t p-4 bg-gray-50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowScheduleModal(false)}>
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AppShell>
  )
}

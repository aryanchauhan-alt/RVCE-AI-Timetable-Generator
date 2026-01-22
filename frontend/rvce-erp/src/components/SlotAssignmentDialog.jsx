import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  BookOpen,
  Users,
  DoorOpen,
  Clock,
  Save,
  Trash2,
  AlertCircle,
  Check,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function SlotAssignmentDialog({
  isOpen,
  onClose,
  slotInfo,
  subjects = [],
  faculty = [],
  rooms = [],
  onSave,
  onDelete,
}) {
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedFaculty, setSelectedFaculty] = useState('')
  const [selectedRoom, setSelectedRoom] = useState('')
  const [isLab, setIsLab] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Pre-fill if editing existing slot
  useEffect(() => {
    if (slotInfo?.existing) {
      setSelectedSubject(slotInfo.existing.code || '')
      setSelectedFaculty(slotInfo.existing.faculty || '')
      setSelectedRoom(slotInfo.existing.room || '')
      setIsLab(slotInfo.existing.type === 'Lab')
    } else {
      setSelectedSubject('')
      setSelectedFaculty('')
      setSelectedRoom('')
      setIsLab(false)
    }
  }, [slotInfo])

  const validateForm = () => {
    const newErrors = {}
    if (!selectedSubject) newErrors.subject = 'Please select a subject'
    if (!selectedFaculty) newErrors.faculty = 'Please select a faculty member'
    if (!selectedRoom) newErrors.room = 'Please select a room'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setSaving(true)
    try {
      await onSave({
        day: slotInfo.day,
        slot: slotInfo.slot,
        subjectCode: selectedSubject,
        facultyId: selectedFaculty,
        roomId: selectedRoom,
        isLab,
      })
      onClose()
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!slotInfo?.existing) return
    setSaving(true)
    try {
      await onDelete({
        day: slotInfo.day,
        slot: slotInfo.slot,
      })
      onClose()
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setSaving(false)
    }
  }

  // Filter rooms based on lab selection
  const filteredRooms = rooms.filter(room => 
    isLab ? room.type === 'Lab' : room.type === 'Lecture'
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-xl">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-white">
            <Clock className="w-5 h-5" />
            {slotInfo?.existing ? 'Edit Slot Assignment' : 'Assign New Slot'}
          </DialogTitle>
          <DialogDescription className="text-blue-100">
            {slotInfo?.day} • {slotInfo?.slot}
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Subject Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-gray-700">
              <BookOpen className="w-4 h-4" />
              Subject
            </Label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className={cn(errors.subject && 'border-red-500')}>
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.code} value={subject.code}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{subject.code}</span>
                      <span className="text-gray-500">-</span>
                      <span className="text-gray-600 truncate max-w-[200px]">{subject.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.subject && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.subject}
              </p>
            )}
          </div>

          {/* Faculty Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-gray-700">
              <Users className="w-4 h-4" />
              Faculty
            </Label>
            <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
              <SelectTrigger className={cn(errors.faculty && 'border-red-500')}>
                <SelectValue placeholder="Select a faculty member" />
              </SelectTrigger>
              <SelectContent>
                {faculty.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                        {f.name?.[0] || 'F'}
                      </div>
                      <span>{f.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.faculty && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.faculty}
              </p>
            )}
          </div>

          {/* Lab Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsLab(!isLab)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                isLab ? "bg-purple-600" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  isLab ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
            <Label className="text-gray-700">
              {isLab ? 'Lab Session' : 'Theory Class'}
            </Label>
          </div>

          {/* Room Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-gray-700">
              <DoorOpen className="w-4 h-4" />
              {isLab ? 'Lab' : 'Classroom'}
            </Label>
            <Select value={selectedRoom} onValueChange={setSelectedRoom}>
              <SelectTrigger className={cn(errors.room && 'border-red-500')}>
                <SelectValue placeholder={`Select a ${isLab ? 'lab' : 'classroom'}`} />
              </SelectTrigger>
              <SelectContent>
                {filteredRooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">{room.id}</span>
                      <span className="text-sm text-gray-500">Cap: {room.capacity}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.room && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.room}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div>
            {slotInfo?.existing && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                disabled={saving}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {slotInfo?.existing ? 'Update' : 'Assign'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Filter,
  Download,
  BookOpen,
  Clock,
  GraduationCap,
  FlaskConical,
  Layers,
  Beaker,
} from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://rvce-ai-timetable-generator.onrender.com'

export default function SubjectsManage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedSemester, setSelectedSemester] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [subjects, setSubjects] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [subjectsRes, deptRes] = await Promise.all([
          fetch(`${API_BASE}/api/timetable/subjects`),
          fetch(`${API_BASE}/api/timetable/departments`)
        ])

        const subjectsData = await subjectsRes.json()
        const deptData = await deptRes.json()

        setSubjects(subjectsData.subjects || [])
        setDepartments(deptData.departments || [])
      } catch (error) {
        console.error('Error fetching subjects:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredSubjects = subjects.filter((s) => {
    const matchesSearch = s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDept = selectedDept === 'all' || s.department === selectedDept
    const matchesSem = selectedSemester === 'all' || s.semester === parseInt(selectedSemester)
    const matchesType = selectedType === 'all' || s.type === selectedType
    return matchesSearch && matchesDept && matchesSem && matchesType
  })

  // Get unique values for filters
  const uniqueDepts = [...new Set(subjects.map(s => s.department))].filter(Boolean).sort()
  const uniqueSemesters = [...new Set(subjects.map(s => s.semester))].filter(Boolean).sort((a, b) => a - b)
  const uniqueTypes = [...new Set(subjects.map(s => s.type))].filter(Boolean).sort()

  // Stats
  const totalSubjects = subjects.length
  // Theory only = subjects with only theory hours (no lab hours)
  const theoryOnlyCount = subjects.filter(s => s.lab_hours === 0 || !s.lab_hours).length
  // Theory + Lab = subjects that have both theory AND lab hours
  const theoryPlusLabCount = subjects.filter(s => s.lab_hours > 0 && s.theory_hours > 0).length
  // Lab only = subjects with only lab hours (no theory hours)  
  const labOnlyCount = subjects.filter(s => s.lab_hours > 0 && (!s.theory_hours || s.theory_hours === 0)).length
  const basketCount = subjects.filter(s => s.is_basket || s.is_pec || s.is_iec).length

  const getTypeColor = (type) => {
    if (type === 'Theory') return 'bg-blue-50 text-blue-700 border-blue-200'
    if (type === 'Lab') return 'bg-purple-50 text-purple-700 border-purple-200'
    if (type === 'Theory + Lab') return 'bg-green-50 text-green-700 border-green-200'
    return 'bg-gray-50 text-gray-700 border-gray-200'
  }

  const getSemesterColor = (sem) => {
    const colors = [
      'bg-red-50 text-red-700 border-red-200',
      'bg-orange-50 text-orange-700 border-orange-200',
      'bg-yellow-50 text-yellow-700 border-yellow-200',
      'bg-green-50 text-green-700 border-green-200',
      'bg-teal-50 text-teal-700 border-teal-200',
      'bg-cyan-50 text-cyan-700 border-cyan-200',
      'bg-blue-50 text-blue-700 border-blue-200',
      'bg-indigo-50 text-indigo-700 border-indigo-200',
    ]
    return colors[(sem - 1) % colors.length]
  }

  const exportToCSV = () => {
    const headers = ['Code', 'Name', 'Department', 'Semester', 'Type', 'Theory Hours', 'Lab Hours', 'Credits']
    const rows = filteredSubjects.map(s => [
      s.code,
      `"${s.name}"`,
      s.department,
      s.semester,
      s.type,
      s.theory_hours,
      s.lab_hours,
      s.credits
    ])

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subjects_data.csv'
    a.click()
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-serif font-bold text-accent-navy">Subjects Management</h1>
          <p className="text-text-secondary mt-1">Manage course catalog, credits, and requirements</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-card border-none">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent-navy/10 rounded-full">
                  <BookOpen className="w-6 h-6 text-accent-navy" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">Total Subjects</p>
                  <p className="text-2xl font-serif font-bold text-accent-navy">{totalSubjects}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-none">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 rounded-full">
                  <Beaker className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">Theory + Lab</p>
                  <p className="text-2xl font-serif font-bold text-accent-navy">{theoryPlusLabCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-none">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent-gold/10 rounded-full">
                  <Layers className="w-6 h-6 text-accent-gold" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">Theory Only</p>
                  <p className="text-2xl font-serif font-bold text-accent-navy">{theoryOnlyCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-none">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-navy/5 rounded-full">
                  <GraduationCap className="w-6 h-6 text-navy" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">Electives</p>
                  <p className="text-2xl font-serif font-bold text-accent-navy">{basketCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="flex flex-1 gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="w-[140px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Depts</SelectItem>
                {uniqueDepts.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSemester} onValueChange={setSelectedSemester}>
              <SelectTrigger className="w-[130px]">
                <Clock className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sems</SelectItem>
                {uniqueSemesters.map(sem => (
                  <SelectItem key={sem} value={String(sem)}>Sem {sem}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[140px]">
                <BookOpen className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Subjects List */}
        <div className="bg-white rounded-lg shadow-card border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-accent-navy text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Subject Details</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">Credits</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSubjects.map((s) => (
                  <tr key={s.id} className="hover:bg-bg-secondary/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent-navy/10 flex items-center justify-center text-accent-navy font-bold text-xs">
                          {s.code.substring(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-accent-navy">{s.name}</p>
                          <p className="text-sm text-text-secondary">{s.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={getTypeColor(s.type)}>
                        {s.type}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="border-gray-200 text-gray-600">
                        {s.department || 'ALL'}
                      </Badge>
                    </td>
                    <td className="p-3 text-center font-medium">{s.credits}</td>
                    <td className="p-3 text-center text-text-secondary">{s.credits * 1 + (s.type === 'Lab' ? 2 : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredSubjects.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No subjects found matching your criteria</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

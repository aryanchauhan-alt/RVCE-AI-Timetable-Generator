import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calendar,
  Users,
  DoorOpen,
  BookOpen,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { getDepartments, getFaculty, getRooms, getTimetable } from '@/services/api'

const statsCards = [
  {
    title: 'Active Schedules',
    key: 'schedules',
    change: '+4 this week',
    icon: Calendar,
    color: 'text-accent-gold',
    bgColor: 'bg-accent-navy',
  },
  {
    title: 'Total Faculty',
    key: 'faculty',
    change: 'All departments',
    icon: Users,
    color: 'text-white',
    bgColor: 'bg-rvce-maroon',
  },
  {
    title: 'Classrooms',
    key: 'rooms',
    change: 'Labs & Lecture halls',
    icon: DoorOpen,
    color: 'text-accent-navy',
    bgColor: 'bg-bg-secondary',
  },
  {
    title: 'Subjects',
    key: 'subjects',
    change: 'Across all semesters',
    icon: BookOpen,
    color: 'text-white',
    bgColor: 'bg-gray-800',
  },
]

const defaultDepartments = [
  { code: 'CSE', name: 'Computer Science & Engineering', sections: 5, faculty: 24 },
  { code: 'ISE', name: 'Information Science & Engineering', sections: 4, faculty: 18 },
  { code: 'ECE', name: 'Electronics & Communication', sections: 4, faculty: 20 },
  { code: 'EEE', name: 'Electrical & Electronics', sections: 3, faculty: 15 },
  { code: 'ME', name: 'Mechanical Engineering', sections: 4, faculty: 22 },
  { code: 'CV', name: 'Civil Engineering', sections: 2, faculty: 12 },
  { code: 'AE', name: 'Aerospace Engineering', sections: 2, faculty: 10 },
  { code: 'BT', name: 'Biotechnology', sections: 2, faculty: 8 },
]

const recentActivity = [
  { action: 'Timetable generated', dept: 'CSE', time: '2 hours ago', status: 'success' },
  { action: 'Faculty updated', dept: 'ECE', time: '5 hours ago', status: 'success' },
  { action: 'Conflict detected', dept: 'ME', time: '1 day ago', status: 'warning' },
  { action: 'Room assigned', dept: 'ISE', time: '2 days ago', status: 'success' },
]

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ faculty: 0, rooms: 0, subjects: 0, schedules: 0 })
  const [departments, setDepartments] = useState([])

  useEffect(() => {
    async function fetchData() {
      try {
        const [deptData, facultyData, roomData, timetableData] = await Promise.all([
          getDepartments().catch(() => []),
          getFaculty().catch(() => ({ faculty: [] })),
          getRooms().catch(() => ({ rooms: [] })),
          getTimetable().catch(() => ({})),
        ])

        const facultyList = facultyData?.faculty || [];
        const roomList = roomData?.rooms || [];

        setDepartments((deptData || []).map(d => ({
          code: d.code,
          name: d.name,
          sections: 4, // Default estimate
          faculty: facultyList.filter(f => f.department === d.code).length
        })))

        // Calculate unique subjects from timetable
        let subjectCount = 0;
        if (timetableData?.sections) {
          const subjects = new Set();
          Object.values(timetableData.sections).forEach(secData => {
            (secData.slots || []).forEach(slot => {
              if (slot.subject?.name) subjects.add(slot.subject.name);
            });
          });
          subjectCount = subjects.size;
        }

        setStats({
          faculty: facultyList.length,
          rooms: roomList.length,
          subjects: subjectCount || 45, // Fallback
          schedules: (deptData || []).length * 2 // Estimate
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <AppShell title="Dashboard">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-8"
      >
        {/* Welcome Section */}
        <motion.div variants={item}>
          <div className="relative overflow-hidden rounded-md bg-accent-navy text-white p-8 md:p-12 shadow-card" style={{ backgroundColor: '#002147' }}>
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <Sparkles size={120} />
            </div>
            <div className="relative z-10 max-w-2xl">
              <h1 className="font-serif text-3xl md:text-4xl font-bold mb-4">
                Welcome back, {user?.username || 'Admin'}
              </h1>
              <p className="text-blue-100 text-lg font-light mb-8 max-w-xl">
                Ready to manage the academic year? Access your latest schedules, faculty reports, and campus analytics.
              </p>

              {isAdmin && (
                <Button
                  onClick={() => navigate('/timetable/setup')}
                  className="bg-accent-gold text-accent-navy hover:bg-white hover:text-accent-navy transition-colors font-bold tracking-wide px-8 py-6 rounded-sm"
                  style={{ backgroundColor: '#c5a059' }}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  GENERATE TIMETABLE
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat, index) => (
            <Card key={index} className="border-none shadow-card hover:shadow-soft transition-all duration-300">
              <CardContent className="p-0 overflow-hidden flex h-full">
                <div className={`w-2 ${stat.bgColor}`} />
                <div className="p-6 flex-1 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-secondary uppercase tracking-wider">{stat.title}</p>
                    {loading ? (
                      <Skeleton className="h-8 w-16 mt-2" />
                    ) : (
                      <p className="text-3xl font-serif font-bold mt-1 text-accent-navy">
                        {stats[stat.key] || 0}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2 font-light italic">{stat.change}</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bgColor} ${stat.color}`}>
                    <stat.icon size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Departments Grid */}
          <motion.div variants={item} className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Departments</CardTitle>
                <CardDescription>Quick access to department schedules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(departments.length > 0 ? departments : defaultDepartments).map((dept, index) => (
                    <motion.button
                      key={dept.code}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/timetable/view?dept=${dept.code}`)}
                      className="p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-bold text-gray-900">
                          {dept.code}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {dept.sections} sections • {dept.faculty} faculty
                      </p>
                    </motion.button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div variants={item}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-full ${activity.status === 'success'
                        ? 'bg-emerald-100'
                        : 'bg-amber-100'
                        }`}>
                        {activity.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.action}
                        </p>
                        <p className="text-xs text-gray-500">
                          {activity.dept} • {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks at your fingertips</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => navigate('/timetable/setup')}
                >
                  <Calendar className="w-5 h-5" />
                  <span>New Timetable</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => navigate('/faculty/manage')}
                >
                  <Users className="w-5 h-5" />
                  <span>Manage Faculty</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => navigate('/rooms/manage')}
                >
                  <DoorOpen className="w-5 h-5" />
                  <span>Manage Rooms</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => navigate('/timetable/view')}
                >
                  <TrendingUp className="w-5 h-5" />
                  <span>View Reports</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AppShell>
  )
}

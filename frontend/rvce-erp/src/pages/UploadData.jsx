import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Users, DoorOpen, GraduationCap, CheckCircle, XCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { uploadService } from '../lib/supabase';

const UploadData = () => {
  const [uploads, setUploads] = useState({
    faculty: { file: null, status: 'idle', message: '', count: 0 },
    rooms: { file: null, status: 'idle', message: '', count: 0 },
    sections: { file: null, status: 'idle', message: '', count: 0 },
  });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState({ type: '', text: '' });

  const uploadConfigs = [
    {
      key: 'faculty',
      title: 'Faculty Data',
      description: 'Upload faculty members with their departments and subject assignments',
      icon: Users,
      expectedColumns: 'faculty_id, faculty_name, department, max_hours_per_week, subject_codes',
      table: 'faculty',
    },
    {
      key: 'rooms',
      title: 'Rooms Data',
      description: 'Upload classroom and lab room information',
      icon: DoorOpen,
      expectedColumns: 'room_id, department, room_type, capacity',
      table: 'rooms',
    },
    {
      key: 'sections',
      title: 'Sections Data',
      description: 'Upload section details with dedicated rooms',
      icon: GraduationCap,
      expectedColumns: 'department, program, academic_year, semester, section, student_count, dedicated_room',
      table: 'sections',
    },
  ];

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          let value = values[index];
          // Try to parse numbers
          if (!isNaN(value) && value !== '') {
            value = Number(value);
          }
          row[header] = value;
        });
        rows.push(row);
      }
    }
    return rows;
  };

  const handleFileSelect = (key, event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setUploads(prev => ({
        ...prev,
        [key]: { ...prev[key], file, status: 'selected', message: `Selected: ${file.name}` }
      }));
    } else {
      setUploads(prev => ({
        ...prev,
        [key]: { ...prev[key], file: null, status: 'error', message: 'Please select a valid CSV file' }
      }));
    }
  };

  const handleUpload = async (key) => {
    const config = uploadConfigs.find(c => c.key === key);
    const file = uploads[key].file;

    if (!file) {
      setUploads(prev => ({
        ...prev,
        [key]: { ...prev[key], status: 'error', message: 'No file selected' }
      }));
      return;
    }

    setUploads(prev => ({
      ...prev,
      [key]: { ...prev[key], status: 'uploading', message: 'Processing...' }
    }));

    try {
      // Read file content
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        throw new Error('No valid data rows found in CSV');
      }

      // Upload to Supabase (delete old, insert new)
      const result = await uploadService.replaceTableData(config.table, rows);

      setUploads(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          status: 'success',
          message: `Successfully uploaded ${result.count} records`,
          count: result.count
        }
      }));
    } catch (error) {
      console.error(`Upload error for ${key}:`, error);
      setUploads(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          status: 'error',
          message: error.message || 'Upload failed'
        }
      }));
    }
  };

  const handleClearTimetable = async () => {
    setClearing(true);
    try {
      const res = await fetch('http://localhost:8000/api/timetable/clear', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setClearMessage({ type: 'success', text: 'Timetable cleared successfully!' });
      } else {
        throw new Error(data.detail || 'Failed to clear');
      }
    } catch (err) {
      setClearMessage({ type: 'error', text: err.message });
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
      setTimeout(() => setClearMessage({ type: '', text: '' }), 3000);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-5 h-5 animate-spin text-accent-navy" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'selected':
        return <FileSpreadsheet className="w-5 h-5 text-accent-gold" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'selected':
        return 'text-accent-gold bg-amber-50';
      case 'uploading':
        return 'text-accent-navy bg-blue-50';
      default:
        return 'text-gray-500 bg-gray-50';
    }
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-accent-navy">Upload Data</h1>
            <p className="text-text-secondary mt-1">
              Upload CSV files to replace existing data in Supabase
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Important Notice</p>
                <p className="text-sm text-amber-700 mt-1">
                  Uploading a new CSV will <strong>delete all existing data</strong> in that table and replace it with the new data.
                  Make sure your CSV file is complete and correct before uploading.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Clear Timetable Utility */}
        <div className="flex justify-end">
          <Button
            variant="destructive"
            onClick={() => setShowClearConfirm(true)}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Timetable (Required before replacing data)
          </Button>
        </div>

        {/* Status Message for Clear */}
        {
          clearMessage.text && (
            <div className={`p-4 rounded-lg flex items-center gap-2 ${clearMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {clearMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {clearMessage.text}
            </div>
          )
        }

        {/* Confirmation Modal */}
        {
          showClearConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Clear Timetable?</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to clear the entire timetable? This action cannot be undone.
                  You must do this before uploading new section or faculty data.
                </p>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={handleClearTimetable}
                    disabled={clearing}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {clearing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Yes, Clear All
                  </Button>
                </div>
              </div>
            </div>
          )
        }

        {/* Upload Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {uploadConfigs.map((config) => {
            const uploadState = uploads[config.key];
            const Icon = config.icon;

            return (
              <Card key={config.key} className="shadow-card border-none">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent-navy/10 rounded-lg">
                      <Icon className="w-6 h-6 text-accent-navy" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-accent-navy">{config.title}</CardTitle>
                      <CardDescription className="text-sm">{config.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Expected Columns */}
                  <div className="text-xs bg-gray-50 p-3 rounded-md">
                    <p className="font-medium text-gray-600 mb-1">Expected columns:</p>
                    <code className="text-gray-500 break-all">{config.expectedColumns}</code>
                  </div>

                  {/* File Input */}
                  <div className="space-y-2">
                    <label
                      htmlFor={`file-${config.key}`}
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-accent-navy hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">
                          <span className="font-medium text-accent-navy">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-400 mt-1">CSV files only</p>
                      </div>
                      <input
                        id={`file-${config.key}`}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => handleFileSelect(config.key, e)}
                      />
                    </label>
                  </div>

                  {/* Status Message */}
                  {uploadState.message && (
                    <div className={`flex items-center gap-2 p-3 rounded-md ${getStatusColor(uploadState.status)}`}>
                      {getStatusIcon(uploadState.status)}
                      <span className="text-sm">{uploadState.message}</span>
                    </div>
                  )}

                  {/* Upload Button */}
                  <Button
                    onClick={() => handleUpload(config.key)}
                    disabled={!uploadState.file || uploadState.status === 'uploading'}
                    className="w-full bg-accent-navy hover:bg-accent-navy/90 text-white"
                  >
                    {uploadState.status === 'uploading' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload & Replace Data
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Instructions */}
        <Card className="shadow-card border-none">
          <CardHeader>
            <CardTitle className="text-accent-navy">CSV Format Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium text-accent-navy mb-2">Faculty CSV</h4>
                <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-x-auto">
                  {`faculty_id,faculty_name,department,max_hours_per_week,subject_codes
FAC001,Dr. Smith,CSE,18,"CS101,CS201"
FAC002,Prof. Jones,ECE,16,"EC101"`}
                </pre>
              </div>
              <div>
                <h4 className="font-medium text-accent-navy mb-2">Rooms CSV</h4>
                <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-x-auto">
                  {`room_id,department,room_type,capacity
CSE-101,CSE,Classroom,60
CSE-LAB1,CSE,Lab,30`}
                </pre>
              </div>
              <div>
                <h4 className="font-medium text-accent-navy mb-2">Sections CSV</h4>
                <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-x-auto">
                  {`department,program,academic_year,semester,section,student_count,dedicated_room
CSE,B.Tech,1,1,A,60,CSE-101
CSE,B.Tech,1,1,B,60,CSE-102`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div >
    </AppShell >
  );
};

export default UploadData;

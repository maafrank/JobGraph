import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadResume, getCurrentResume, downloadResume, deleteResume } from '../../services/resumeService';
import { useToast } from '../common/Toast';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { LoadingSpinner } from '../common/LoadingSpinner';

export default function ResumeSection() {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch current resume with polling while processing
  const { data: resume, isLoading } = useQuery({
    queryKey: ['currentResume'],
    queryFn: getCurrentResume,
    retry: false,
    refetchInterval: (query) => {
      // Poll every 3 seconds while status is 'processing'
      const data = query.state.data;
      return data?.uploadStatus === 'processing' ? 3000 : false;
    },
  });

  // Auto-refresh profile data when resume parsing completes
  useEffect(() => {
    if (resume?.uploadStatus === 'completed' && resume?.hasParsedData) {
      // Check if we've already refreshed for this document
      const hasRefreshed = sessionStorage.getItem(`resume-refreshed-${resume.documentId}`);

      if (!hasRefreshed) {
        // Mark as refreshed before doing anything else
        sessionStorage.setItem(`resume-refreshed-${resume.documentId}`, 'true');

        // Invalidate all profile-related queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['education'] });
        queryClient.invalidateQueries({ queryKey: ['workExperience'] });
        queryClient.invalidateQueries({ queryKey: ['skills'] });

        toast.success('Resume parsed and profile auto-filled successfully!');

        // Hard refresh the page after a short delay to show the toast
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    }
  }, [resume?.uploadStatus, resume?.hasParsedData, resume?.documentId, queryClient, toast]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: uploadResume,
    onSuccess: (data) => {
      toast.success('Resume uploaded successfully! Parsing in progress...');
      queryClient.invalidateQueries({ queryKey: ['currentResume'] });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to upload resume');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteResume,
    onSuccess: () => {
      toast.success('Resume deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['currentResume'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete resume');
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF, DOCX, or TXT file');
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!resume) return;

    try {
      const blob = await downloadResume();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = resume.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Resume downloaded successfully');
    } catch (error) {
      toast.error('Failed to download resume');
    }
  };

  const handleDelete = async () => {
    if (!resume) return;

    if (!window.confirm('Are you sure you want to delete your resume?')) {
      return;
    }

    deleteMutation.mutate(resume.documentId);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      </Card>
    );
  }

  return (
    <Card title="Resume" subtitle="Upload your resume for better profile auto-fill">
      <div className="space-y-4">
        {/* Current Resume Display */}
        {resume ? (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">{resume.fileName}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(resume.fileSize)} • Uploaded {formatDate(resume.uploadedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  {getStatusBadge(resume.uploadStatus)}
                  {resume.uploadStatus === 'completed' && resume.hasParsedData && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Profile Auto-filled
                    </span>
                  )}
                </div>

                {resume.processingError && (
                  <div className="mt-3 text-sm text-red-600">
                    Error: {resume.processingError}
                  </div>
                )}
              </div>

              <div className="flex gap-2 ml-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownload}
                >
                  Download
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  loading={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-600">No resume uploaded</p>
          </div>
        )}

        {/* Upload Button */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-gray-600">
            Supported formats: PDF, DOCX, TXT (max 10MB)
          </p>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              loading={isUploading}
            >
              {resume ? 'Replace Resume' : 'Upload Resume'}
            </Button>
          </div>
        </div>

        {/* Info Box */}
        {!resume && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div className="flex">
              <svg className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Upload your resume to auto-fill your profile!</p>
                <p>We'll automatically populate your profile with:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Contact details and location</li>
                  <li>Professional summary</li>
                  <li>Work experience history</li>
                  <li>Education background</li>
                  <li>Skills and technologies</li>
                </ul>
                <p className="mt-2 text-xs">All data will be added to your profile automatically after parsing completes.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { Layout } from '../../components/layout';
import { Card, Button, Input, Textarea, Select, LoadingSpinner, Modal, useToast } from '../../components/common';
import { profileService } from '../../services/profileService';
import type { CandidateProfile, Education, WorkExperience } from '../../types';
import ResumeSection from '../../components/profile/ResumeSection';

export const ProfilePage = () => {
  const toast = useToast();

  // Profile state
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Basic info edit state
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [basicInfo, setBasicInfo] = useState({
    headline: '',
    summary: '',
    city: '',
    state: '',
    country: '',
    yearsExperience: 0,
    remotePreference: 'onsite' as 'remote' | 'hybrid' | 'onsite' | 'flexible',
    willingToRelocate: false,
    profileVisibility: 'public' as 'public' | 'private' | 'anonymous',
  });

  // Education modal state
  const [isEducationModalOpen, setIsEducationModalOpen] = useState(false);
  const [editingEducation, setEditingEducation] = useState<Education | null>(null);
  const [educationForm, setEducationForm] = useState({
    degree: '',
    fieldOfStudy: '',
    institution: '',
    graduationYear: new Date().getFullYear(),
    gpa: '',
  });

  // Work experience modal state
  const [isExperienceModalOpen, setIsExperienceModalOpen] = useState(false);
  const [editingExperience, setEditingExperience] = useState<WorkExperience | null>(null);
  const [experienceForm, setExperienceForm] = useState({
    jobTitle: '',
    company: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: '',
  });

  // Fetch profile on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const data = await profileService.getProfile();
      setProfile(data);

      // Initialize basic info form with profile data
      setBasicInfo({
        headline: data.headline || '',
        summary: data.summary || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country || '',
        yearsExperience: data.yearsExperience || 0,
        remotePreference: data.remotePreference || 'onsite',
        willingToRelocate: data.willingToRelocate || false,
        profileVisibility: data.profileVisibility || 'public',
      });
    } catch (error: any) {
      toast.error('Failed to load profile');
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Basic info handlers
  const handleBasicInfoSave = async () => {
    try {
      setIsSaving(true);
      await profileService.updateProfile(basicInfo);
      await fetchProfile(); // Re-fetch to get complete profile with education and work experience
      setIsEditingBasic(false);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error('Failed to update profile');
      console.error('Error updating profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBasicInfoCancel = () => {
    if (profile) {
      setBasicInfo({
        headline: profile.headline || '',
        summary: profile.summary || '',
        city: profile.city || '',
        state: profile.state || '',
        country: profile.country || '',
        yearsExperience: profile.yearsExperience || 0,
        remotePreference: profile.remotePreference || 'onsite',
        willingToRelocate: profile.willingToRelocate || false,
        profileVisibility: profile.profileVisibility || 'public',
      });
    }
    setIsEditingBasic(false);
  };

  // Education handlers
  const handleAddEducation = () => {
    setEditingEducation(null);
    setEducationForm({
      degree: '',
      fieldOfStudy: '',
      institution: '',
      graduationYear: new Date().getFullYear(),
      gpa: '',
    });
    setIsEducationModalOpen(true);
  };

  const handleEditEducation = (edu: any) => {
    setEditingEducation(edu);
    setEducationForm({
      degree: edu.degree,
      fieldOfStudy: edu.field_of_study || '',
      institution: edu.institution,
      graduationYear: edu.graduation_year,
      gpa: edu.gpa?.toString() || '',
    });
    setIsEducationModalOpen(true);
  };

  const handleSaveEducation = async () => {
    try {
      setIsSaving(true);

      const eduData = {
        degree: educationForm.degree,
        fieldOfStudy: educationForm.fieldOfStudy || null,
        institution: educationForm.institution,
        graduationYear: educationForm.graduationYear,
        gpa: educationForm.gpa ? parseFloat(educationForm.gpa) : null,
      };

      if (editingEducation) {
        await profileService.updateEducation((editingEducation as any).education_id, eduData);
        toast.success('Education updated successfully');
      } else {
        await profileService.addEducation(eduData);
        toast.success('Education added successfully');
      }

      await fetchProfile();
      setIsEducationModalOpen(false);
    } catch (error: any) {
      toast.error('Failed to save education');
      console.error('Error saving education:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEducation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this education entry?')) return;

    try {
      await profileService.deleteEducation(id);
      toast.success('Education deleted successfully');
      await fetchProfile();
    } catch (error: any) {
      toast.error('Failed to delete education');
      console.error('Error deleting education:', error);
    }
  };

  // Work experience handlers
  const handleAddExperience = () => {
    setEditingExperience(null);
    setExperienceForm({
      jobTitle: '',
      company: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      description: '',
    });
    setIsExperienceModalOpen(true);
  };

  const handleEditExperience = (exp: any) => {
    setEditingExperience(exp);
    setExperienceForm({
      jobTitle: exp.title,
      company: exp.company,
      startDate: exp.start_date.split('T')[0],
      endDate: exp.end_date ? exp.end_date.split('T')[0] : '',
      isCurrent: exp.is_current,
      description: exp.description || '',
    });
    setIsExperienceModalOpen(true);
  };

  const handleSaveExperience = async () => {
    try {
      setIsSaving(true);

      const expData = {
        title: experienceForm.jobTitle,
        company: experienceForm.company,
        startDate: experienceForm.startDate,
        endDate: experienceForm.isCurrent ? null : experienceForm.endDate || null,
        isCurrent: experienceForm.isCurrent,
        description: experienceForm.description || null,
      };

      if (editingExperience) {
        await profileService.updateExperience((editingExperience as any).experience_id, expData);
        toast.success('Experience updated successfully');
      } else{
        await profileService.addExperience(expData);
        toast.success('Experience added successfully');
      }

      await fetchProfile();
      setIsExperienceModalOpen(false);
    } catch (error: any) {
      toast.error('Failed to save experience');
      console.error('Error saving experience:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    if (!confirm('Are you sure you want to delete this work experience entry?')) return;

    try {
      await profileService.deleteExperience(id);
      toast.success('Experience deleted successfully');
      await fetchProfile();
    } catch (error: any) {
      toast.error('Failed to delete experience');
      console.error('Error deleting experience:', error);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
            <p className="mt-2 text-gray-600">Manage your professional information</p>
          </div>
        </div>

        {/* Resume Upload Section */}
        <ResumeSection />

        {/* Basic Information Section */}
        <Card title="Basic Information">
          {!isEditingBasic ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Headline</label>
                  <p className="mt-1 text-gray-900">{profile?.headline || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Years of Experience</label>
                  <p className="mt-1 text-gray-900">{profile?.yearsExperience || 0} years</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Summary</label>
                <p className="mt-1 text-gray-900 whitespace-pre-wrap">{profile?.summary || 'Not set'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">City</label>
                  <p className="mt-1 text-gray-900">{profile?.city || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">State</label>
                  <p className="mt-1 text-gray-900">{profile?.state || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Country</label>
                  <p className="mt-1 text-gray-900">{profile?.country || 'Not set'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Remote Preference</label>
                  <p className="mt-1 text-gray-900 capitalize">{profile?.remotePreference || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Willing to Relocate</label>
                  <p className="mt-1 text-gray-900">{profile?.willingToRelocate ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Profile Visibility</label>
                  <p className="mt-1 text-gray-900 capitalize">{profile?.profileVisibility || 'public'}</p>
                </div>
              </div>

              <div className="pt-4">
                <Button variant="primary" onClick={() => setIsEditingBasic(true)}>
                  Edit Basic Information
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                label="Headline"
                value={basicInfo.headline}
                onChange={(e) => setBasicInfo({ ...basicInfo, headline: e.target.value })}
                placeholder="e.g., Senior Software Engineer"
              />

              <Textarea
                label="Summary"
                value={basicInfo.summary}
                onChange={(e) => setBasicInfo({ ...basicInfo, summary: e.target.value })}
                placeholder="Tell us about yourself..."
                rows={4}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="City"
                  value={basicInfo.city}
                  onChange={(e) => setBasicInfo({ ...basicInfo, city: e.target.value })}
                  placeholder="San Francisco"
                />
                <Input
                  label="State"
                  value={basicInfo.state}
                  onChange={(e) => setBasicInfo({ ...basicInfo, state: e.target.value })}
                  placeholder="CA"
                />
                <Input
                  label="Country"
                  value={basicInfo.country}
                  onChange={(e) => setBasicInfo({ ...basicInfo, country: e.target.value })}
                  placeholder="USA"
                />
              </div>

              <Input
                label="Years of Experience"
                type="number"
                value={basicInfo.yearsExperience}
                onChange={(e) => setBasicInfo({ ...basicInfo, yearsExperience: parseInt(e.target.value) || 0 })}
                min={0}
              />

              <Select
                label="Remote Preference"
                value={basicInfo.remotePreference}
                onChange={(e) => setBasicInfo({ ...basicInfo, remotePreference: e.target.value as any })}
                options={[
                  { value: 'onsite', label: 'Onsite' },
                  { value: 'hybrid', label: 'Hybrid' },
                  { value: 'remote', label: 'Remote' },
                  { value: 'flexible', label: 'Flexible' },
                ]}
              />

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={basicInfo.willingToRelocate}
                  onChange={(e) => setBasicInfo({ ...basicInfo, willingToRelocate: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-900">Willing to relocate</span>
              </label>

              <Select
                label="Profile Visibility"
                value={basicInfo.profileVisibility}
                onChange={(e) => setBasicInfo({ ...basicInfo, profileVisibility: e.target.value as any })}
                options={[
                  { value: 'public', label: 'Public - Visible to all employers' },
                  { value: 'private', label: 'Private - Only visible to contacted employers' },
                  { value: 'anonymous', label: 'Anonymous - Hidden until you respond' },
                ]}
              />

              <div className="flex gap-3 pt-4">
                <Button variant="primary" onClick={handleBasicInfoSave} isLoading={isSaving}>
                  Save Changes
                </Button>
                <Button variant="secondary" onClick={handleBasicInfoCancel} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Education Section */}
        <Card title="Education">
          <div className="space-y-4">
            {profile?.education && profile.education.length > 0 ? (
              <div className="space-y-3">
                {profile.education.map((edu: any) => (
                  <div key={edu.education_id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-base font-medium text-gray-900">{edu.degree}</h4>
                        {edu.field_of_study && (
                          <p className="text-sm text-gray-600">{edu.field_of_study}</p>
                        )}
                        <p className="text-sm text-gray-600">{edu.institution}</p>
                        <p className="text-sm text-gray-500">Graduated: {edu.graduation_year}</p>
                        {edu.gpa && <p className="text-sm text-gray-500">GPA: {edu.gpa}</p>}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button variant="ghost" size="sm" onClick={() => handleEditEducation(edu)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDeleteEducation(edu.education_id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No education added yet</p>
            )}

            <Button variant="secondary" onClick={handleAddEducation}>
              + Add Education
            </Button>
          </div>
        </Card>

        {/* Work Experience Section */}
        <Card title="Work Experience">
          <div className="space-y-4">
            {profile?.workExperience && profile.workExperience.length > 0 ? (
              <div className="space-y-3">
                {profile.workExperience.map((exp: any) => (
                  <div key={exp.experience_id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-base font-medium text-gray-900">{exp.title}</h4>
                        <p className="text-sm text-gray-600">{exp.company}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(exp.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} -
                          {exp.is_current ? ' Present' : exp.end_date ? ` ${new Date(exp.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ' Present'}
                        </p>
                        {exp.description && (
                          <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{exp.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button variant="ghost" size="sm" onClick={() => handleEditExperience(exp)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDeleteExperience(exp.experience_id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No work experience added yet</p>
            )}

            <Button variant="secondary" onClick={handleAddExperience}>
              + Add Work Experience
            </Button>
          </div>
        </Card>

        {/* Education Modal */}
        <Modal
          isOpen={isEducationModalOpen}
          onClose={() => setIsEducationModalOpen(false)}
          title={editingEducation ? 'Edit Education' : 'Add Education'}
        >
          <div className="space-y-4">
            <Input
              label="Degree"
              value={educationForm.degree}
              onChange={(e) => setEducationForm({ ...educationForm, degree: e.target.value })}
              placeholder="e.g., Bachelor of Science"
              required
            />

            <Input
              label="Field of Study"
              value={educationForm.fieldOfStudy}
              onChange={(e) => setEducationForm({ ...educationForm, fieldOfStudy: e.target.value })}
              placeholder="e.g., Computer Science"
            />

            <Input
              label="Institution"
              value={educationForm.institution}
              onChange={(e) => setEducationForm({ ...educationForm, institution: e.target.value })}
              placeholder="e.g., Stanford University"
              required
            />

            <Input
              label="Graduation Year"
              type="number"
              value={educationForm.graduationYear}
              onChange={(e) => setEducationForm({ ...educationForm, graduationYear: parseInt(e.target.value) })}
              min={1950}
              max={new Date().getFullYear() + 10}
              required
            />

            <Input
              label="GPA (optional)"
              type="number"
              step="0.01"
              value={educationForm.gpa}
              onChange={(e) => setEducationForm({ ...educationForm, gpa: e.target.value })}
              placeholder="e.g., 3.75"
            />

            <div className="flex gap-3 pt-4">
              <Button variant="primary" onClick={handleSaveEducation} isLoading={isSaving}>
                {editingEducation ? 'Update' : 'Add'} Education
              </Button>
              <Button variant="secondary" onClick={() => setIsEducationModalOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>

        {/* Work Experience Modal */}
        <Modal
          isOpen={isExperienceModalOpen}
          onClose={() => setIsExperienceModalOpen(false)}
          title={editingExperience ? 'Edit Work Experience' : 'Add Work Experience'}
        >
          <div className="space-y-4">
            <Input
              label="Job Title"
              value={experienceForm.jobTitle}
              onChange={(e) => setExperienceForm({ ...experienceForm, jobTitle: e.target.value })}
              placeholder="e.g., Senior Software Engineer"
              required
            />

            <Input
              label="Company"
              value={experienceForm.company}
              onChange={(e) => setExperienceForm({ ...experienceForm, company: e.target.value })}
              placeholder="e.g., Google"
              required
            />

            <Input
              label="Start Date"
              type="date"
              value={experienceForm.startDate}
              onChange={(e) => setExperienceForm({ ...experienceForm, startDate: e.target.value })}
              required
            />

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={experienceForm.isCurrent}
                onChange={(e) => setExperienceForm({ ...experienceForm, isCurrent: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-900">I currently work here</span>
            </label>

            {!experienceForm.isCurrent && (
              <Input
                label="End Date"
                type="date"
                value={experienceForm.endDate}
                onChange={(e) => setExperienceForm({ ...experienceForm, endDate: e.target.value })}
              />
            )}

            <Textarea
              label="Description (optional)"
              value={experienceForm.description}
              onChange={(e) => setExperienceForm({ ...experienceForm, description: e.target.value })}
              placeholder="Describe your responsibilities and achievements..."
              rows={4}
            />

            <div className="flex gap-3 pt-4">
              <Button variant="primary" onClick={handleSaveExperience} isLoading={isSaving}>
                {editingExperience ? 'Update' : 'Add'} Experience
              </Button>
              <Button variant="secondary" onClick={() => setIsExperienceModalOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
};

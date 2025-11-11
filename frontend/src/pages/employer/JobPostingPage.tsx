import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../../components/layout';
import { Card, Button, Input, Textarea, Select, LoadingSpinner, useToast, Modal } from '../../components/common';
import { jobService, type CreateJobData, type JobSkillData } from '../../services/jobService';
import { skillsService } from '../../services/skillsService';
import { companyService } from '../../services/companyService';
import type { Job, Skill, JobSkill, EmploymentType, ExperienceLevel, RemoteOption } from '../../types';

interface SkillFormData {
  skillId: string;
  weight: number;
  minimumScore: number;
  required: boolean;
}

export const JobPostingPage = () => {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId?: string }>();
  const toast = useToast();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState<CreateJobData>({
    companyId: '',
    title: '',
    description: '',
    requirements: '',
    responsibilities: '',
    city: '',
    state: '',
    country: '',
    remoteOption: 'onsite',
    employmentType: 'full-time',
    experienceLevel: 'mid',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'USD',
    status: 'draft',
  });

  // Skills state
  const [jobSkills, setJobSkills] = useState<JobSkill[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<JobSkill | null>(null);
  const [skillFormData, setSkillFormData] = useState<SkillFormData>({
    skillId: '',
    weight: 50,
    minimumScore: 60,
    required: true,
  });

  // Load job if editing
  useEffect(() => {
    if (jobId) {
      loadJob(jobId);
    }
  }, [jobId]);

  // Load company ID and available skills
  useEffect(() => {
    loadCompanyId();
    loadSkills();
  }, []);

  const loadCompanyId = async () => {
    try {
      const company = await companyService.getMyCompany();
      const cid = company.companyId;
      setCompanyId(cid);
      // Update formData with companyId
      setFormData(prev => ({ ...prev, companyId: cid }));
    } catch (error) {
      toast.error('You need to create a company profile first');
      navigate('/employer/company');
    }
  };

  const loadJob = async (id: string) => {
    try {
      setIsLoading(true);
      const jobData = await jobService.getJobById(id);
      setJob(jobData);

      // Populate form
      setFormData({
        companyId: jobData.companyId,
        title: jobData.title,
        description: jobData.description,
        requirements: jobData.requirements || '',
        responsibilities: jobData.responsibilities || '',
        city: jobData.city || '',
        state: jobData.state || '',
        country: jobData.country || '',
        remoteOption: jobData.remoteOption,
        employmentType: jobData.employmentType,
        experienceLevel: jobData.experienceLevel,
        salaryMin: jobData.salaryMin,
        salaryMax: jobData.salaryMax,
        salaryCurrency: jobData.salaryCurrency || 'USD',
        status: jobData.status,
      });

      // Set job skills from the job data (backend includes them in getJobById)
      setJobSkills(jobData.requiredSkills || []);
    } catch (error) {
      toast.error('Failed to load job');
      console.error('Error loading job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSkills = async () => {
    try {
      const { skills } = await skillsService.getSkills({ active: true, limit: 1000 });
      setAvailableSkills(skills);
    } catch (error) {
      console.error('Error loading skills:', error);
    }
  };

  const handleInputChange = (field: keyof CreateJobData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveJob = async (publish: boolean = false) => {
    // Validation
    if (!formData.title.trim()) {
      toast.error('Job title is required');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Job description is required');
      return;
    }

    try {
      setIsSaving(true);

      const dataToSave = {
        ...formData,
        status: publish ? 'active' : 'draft',
      };

      let savedJob: any;
      if (jobId) {
        // Update existing job
        savedJob = await jobService.updateJob(jobId, dataToSave);
        toast.success('Job updated successfully');
      } else {
        // Create new job
        savedJob = await jobService.createJob(dataToSave);
        toast.success('Job created successfully');
      }

      // Navigate to the job (if newly created) or stay on page
      if (!jobId) {
        // Backend returns jobId in camelCase
        const newJobId = savedJob.jobId || savedJob.job_id;
        navigate(`/employer/jobs/${newJobId}/edit`, { replace: true });
      } else {
        setJob(savedJob);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to save job';
      toast.error(errorMessage);
      console.error('Error saving job:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenSkillModal = (skill?: JobSkill) => {
    if (skill) {
      // Editing existing skill
      setEditingSkill(skill);
      setSkillFormData({
        skillId: skill.skillId,
        weight: skill.weight,
        minimumScore: skill.minimumScore,
        required: skill.required,
      });
    } else {
      // Adding new skill
      setEditingSkill(null);
      setSkillFormData({
        skillId: '',
        weight: 50,
        minimumScore: 60,
        required: true,
      });
    }
    setIsSkillModalOpen(true);
  };

  const handleCloseSkillModal = () => {
    setIsSkillModalOpen(false);
    setEditingSkill(null);
  };

  const handleSaveSkill = async () => {
    if (!jobId) {
      toast.error('Please save the job first before adding skills');
      return;
    }

    if (!skillFormData.skillId) {
      toast.error('Please select a skill');
      return;
    }

    // Check if skill already exists (when adding new)
    if (!editingSkill && jobSkills.some(s => s.skillId === skillFormData.skillId)) {
      toast.info('This skill is already added to the job');
      return;
    }

    try {
      if (editingSkill) {
        // Update existing skill
        await jobService.updateJobSkill(jobId, editingSkill.skillId, {
          skillId: editingSkill.skillId,
          weight: skillFormData.weight,
          minimumScore: skillFormData.minimumScore,
          required: skillFormData.required,
        });
        toast.success('Skill updated successfully');
      } else {
        // Add new skill
        await jobService.addJobSkill(jobId, {
          skillId: skillFormData.skillId,
          weight: skillFormData.weight,
          minimumScore: skillFormData.minimumScore,
          required: skillFormData.required,
        });
        toast.success('Skill added successfully');
      }

      // Reload job to get updated skills
      await loadJob(jobId);
      handleCloseSkillModal();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to save skill';
      toast.error(errorMessage);
      console.error('Error saving skill:', error);
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    if (!jobId) return;

    if (!confirm('Are you sure you want to remove this skill from the job?')) {
      return;
    }

    try {
      await jobService.removeJobSkill(jobId, skillId);
      toast.success('Skill removed successfully');

      // Reload job to get updated skills
      await loadJob(jobId);
    } catch (error) {
      toast.error('Failed to remove skill');
      console.error('Error removing skill:', error);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  const requiredSkills = jobSkills.filter(s => s.required);
  const optionalSkills = jobSkills.filter(s => !s.required);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {jobId ? 'Edit Job Posting' : 'Create New Job Posting'}
          </h1>
          <p className="text-gray-600 mt-1">
            {jobId ? 'Update your job posting details and requirements' : 'Fill in the details to create a new job posting'}
          </p>
        </div>

        {/* Basic Information */}
        <Card title="Job Details">
          <div className="space-y-6">
            {/* Title */}
            <Input
              label="Job Title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              placeholder="Senior Software Engineer"
            />

            {/* Description */}
            <Textarea
              label="Job Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              required
              rows={6}
              placeholder="Describe the role, what the candidate will be doing, and what makes this opportunity unique..."
            />

            {/* Requirements */}
            <Textarea
              label="Requirements"
              value={formData.requirements || ''}
              onChange={(e) => handleInputChange('requirements', e.target.value)}
              rows={5}
              placeholder="List the qualifications, experience, and skills required for this position..."
              helperText="Optional: You'll add specific skill requirements in the Skills section below"
            />

            {/* Responsibilities */}
            <Textarea
              label="Responsibilities"
              value={formData.responsibilities || ''}
              onChange={(e) => handleInputChange('responsibilities', e.target.value)}
              rows={5}
              placeholder="Outline the key responsibilities and day-to-day activities..."
            />
          </div>
        </Card>

        {/* Employment Details */}
        <Card title="Employment Details" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employment Type */}
            <Select
              label="Employment Type"
              value={formData.employmentType}
              onChange={(e) => handleInputChange('employmentType', e.target.value as EmploymentType)}
              required
              options={[
                { value: 'full-time', label: 'Full Time' },
                { value: 'part-time', label: 'Part Time' },
                { value: 'contract', label: 'Contract' },
                { value: 'internship', label: 'Internship' },
              ]}
            />

            {/* Experience Level */}
            <Select
              label="Experience Level"
              value={formData.experienceLevel}
              onChange={(e) => handleInputChange('experienceLevel', e.target.value as ExperienceLevel)}
              required
              options={[
                { value: 'entry', label: 'Entry Level' },
                { value: 'mid', label: 'Mid Level' },
                { value: 'senior', label: 'Senior' },
                { value: 'lead', label: 'Lead' },
                { value: 'executive', label: 'Executive' },
              ]}
            />
          </div>

          {/* Salary Range */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Salary Range (Optional)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                type="number"
                label="Minimum"
                value={formData.salaryMin?.toString() || ''}
                onChange={(e) => handleInputChange('salaryMin', e.target.value ? Number(e.target.value) : null)}
                placeholder="50000"
              />
              <Input
                type="number"
                label="Maximum"
                value={formData.salaryMax?.toString() || ''}
                onChange={(e) => handleInputChange('salaryMax', e.target.value ? Number(e.target.value) : null)}
                placeholder="80000"
              />
              <Select
                label="Currency"
                value={formData.salaryCurrency || 'USD'}
                onChange={(e) => handleInputChange('salaryCurrency', e.target.value)}
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'EUR', label: 'EUR' },
                  { value: 'GBP', label: 'GBP' },
                  { value: 'CAD', label: 'CAD' },
                ]}
              />
            </div>
          </div>
        </Card>

        {/* Location */}
        <Card title="Location" className="mt-6">
          <div className="space-y-4">
            {/* Work Location Type */}
            <Select
              label="Work Location Type"
              value={formData.remoteOption}
              onChange={(e) => handleInputChange('remoteOption', e.target.value as RemoteOption)}
              required
              options={[
                { value: 'onsite', label: 'On-site (Office-based)' },
                { value: 'remote', label: 'Fully Remote' },
                { value: 'hybrid', label: 'Hybrid (Mix of remote & office)' },
                { value: 'flexible', label: 'Flexible (Employee choice)' },
              ]}
            />

            {/* Location fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="City"
                value={formData.city || ''}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="San Francisco"
              />
              <Input
                label="State/Province"
                value={formData.state || ''}
                onChange={(e) => handleInputChange('state', e.target.value)}
                placeholder="CA"
              />
              <Input
                label="Country"
                value={formData.country || ''}
                onChange={(e) => handleInputChange('country', e.target.value)}
                placeholder="United States"
              />
            </div>
          </div>
        </Card>

        {/* Skills Section */}
        <Card title="Required Skills" className="mt-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-4">
              Add skills required for this position. Set weights to indicate importance and minimum scores to filter candidates.
            </p>
            <Button
              onClick={() => handleOpenSkillModal()}
              disabled={!jobId}
              variant="secondary"
              size="sm"
            >
              + Add Skill
            </Button>
            {!jobId && (
              <p className="text-sm text-amber-600 mt-2">
                Save the job first before adding skills
              </p>
            )}
          </div>

          {/* Required Skills */}
          {requiredSkills.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Required Skills</h4>
              <div className="space-y-3">
                {requiredSkills.map((skill) => (
                  <div
                    key={skill.jobSkillId}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{skill.skillName}</span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {skill.category}
                        </span>
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
                          REQUIRED
                        </span>
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-gray-600">
                        <span>Weight: {skill.weight}%</span>
                        <span>Minimum Score: {skill.minimumScore}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenSkillModal(skill)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveSkill(skill.skillId)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional Skills */}
          {optionalSkills.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Optional Skills (Nice to Have)</h4>
              <div className="space-y-3">
                {optionalSkills.map((skill) => (
                  <div
                    key={skill.jobSkillId}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{skill.skillName}</span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {skill.category}
                        </span>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          OPTIONAL
                        </span>
                      </div>
                      <div className="flex gap-4 mt-2 text-sm text-gray-600">
                        <span>Weight: {skill.weight}%</span>
                        <span>Minimum Score: {skill.minimumScore}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenSkillModal(skill)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveSkill(skill.skillId)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {jobSkills.length === 0 && jobId && (
            <p className="text-center text-gray-500 py-8">
              No skills added yet. Click "Add Skill" to start adding requirements.
            </p>
          )}
        </Card>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4 pb-8">
          <Button
            onClick={() => handleSaveJob(false)}
            isLoading={isSaving}
            disabled={isSaving}
            variant="secondary"
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSaveJob(true)}
            isLoading={isSaving}
            disabled={isSaving}
          >
            {job?.status === 'active' ? 'Update & Keep Active' : 'Save & Publish'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/employer/jobs')}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>

        {/* Skill Modal */}
        <Modal
          isOpen={isSkillModalOpen}
          onClose={handleCloseSkillModal}
          title={editingSkill ? 'Edit Skill Requirement' : 'Add Skill Requirement'}
          size="md"
        >
          <div className="space-y-6">
            {/* Skill Selection */}
            <Select
              label="Skill"
              value={skillFormData.skillId}
              onChange={(e) => setSkillFormData(prev => ({ ...prev, skillId: e.target.value }))}
              disabled={!!editingSkill}
              required
              options={[
                { value: '', label: 'Select a skill...' },
                ...availableSkills.map(skill => ({
                  value: skill.skill_id,
                  label: `${skill.skill_name} (${skill.category})`,
                })),
              ]}
            />

            {/* Required/Optional */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={skillFormData.required}
                    onChange={() => setSkillFormData(prev => ({ ...prev, required: true }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Required</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!skillFormData.required}
                    onChange={() => setSkillFormData(prev => ({ ...prev, required: false }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Optional (Nice to have)</span>
                </label>
              </div>
            </div>

            {/* Weight Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight (Importance): {skillFormData.weight}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={skillFormData.weight}
                onChange={(e) => setSkillFormData(prev => ({ ...prev, weight: Number(e.target.value) }))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Higher weight means this skill is more important in matching calculations
              </p>
            </div>

            {/* Minimum Score Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Score Required: {skillFormData.minimumScore}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={skillFormData.minimumScore}
                onChange={(e) => setSkillFormData(prev => ({ ...prev, minimumScore: Number(e.target.value) }))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Candidates must have at least this score to be matched with this job
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSaveSkill} className="flex-1">
                {editingSkill ? 'Update Skill' : 'Add Skill'}
              </Button>
              <Button variant="secondary" onClick={handleCloseSkillModal} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
};

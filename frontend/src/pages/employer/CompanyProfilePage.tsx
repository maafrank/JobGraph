import { useEffect, useState } from 'react';
import { Layout } from '../../components/layout';
import { Card, Button, Input, Textarea, Select, LoadingSpinner, useToast } from '../../components/common';
import { companyService } from '../../services/companyService';
import type { Company, CompanyFormData } from '../../types';

export const CompanyProfilePage = () => {
  const toast = useToast();

  // Company state
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasCompany, setHasCompany] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    description: '',
    industry: '',
    companySize: '',
    website: '',
    city: '',
    state: '',
    country: '',
  });

  // Fetch company on mount
  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    try {
      setIsLoading(true);
      const data = await companyService.getMyCompany();
      setCompany(data);
      setHasCompany(true);

      // Initialize form with company data
      setFormData({
        name: data.name || '',
        description: data.description || '',
        industry: data.industry || '',
        companySize: data.companySize || '',
        website: data.website || '',
        city: data.location?.city || '',
        state: data.location?.state || '',
        country: data.location?.country || '',
      });
    } catch (error: any) {
      // If 404, user doesn't have a company yet - show create form
      if (error.response?.status === 404) {
        setHasCompany(false);
        setIsEditing(true); // Auto-enable editing for first-time setup
      } else {
        toast.error('Failed to load company profile');
        console.error('Error fetching company:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof CompanyFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Company name is required');
      return;
    }

    try {
      setIsSaving(true);

      if (hasCompany) {
        // Update existing company
        await companyService.updateCompany(formData);
        toast.success('Company profile updated successfully');
      } else {
        // Create new company
        await companyService.createCompany(formData);
        toast.success('Company profile created successfully');
        setHasCompany(true);
      }

      // Re-fetch to get the updated data
      await fetchCompany();
      setIsEditing(false);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to save company profile';
      toast.error(errorMessage);
      console.error('Error saving company:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (company) {
      // Reset form to current company data
      setFormData({
        name: company.name || '',
        description: company.description || '',
        industry: company.industry || '',
        companySize: company.companySize || '',
        website: company.website || '',
        city: company.location?.city || '',
        state: company.location?.state || '',
        country: company.location?.country || '',
      });
    }
    setIsEditing(false);
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Company Profile</h1>
            <p className="text-gray-600 mt-1">
              {hasCompany ? 'Manage your company information' : 'Create your company profile to start posting jobs'}
            </p>
          </div>
          {hasCompany && !isEditing && (
            <Button onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          )}
        </div>

        <Card>
          {/* Company Name */}
          <div className="mb-6">
            <Input
              label="Company Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={!isEditing}
              required
              placeholder="Acme Corporation"
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <Textarea
              label="Company Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              disabled={!isEditing}
              rows={5}
              placeholder="Tell candidates about your company, culture, and mission..."
            />
          </div>

          {/* Industry */}
          <div className="mb-6">
            <Select
              label="Industry"
              value={formData.industry}
              onChange={(e) => handleInputChange('industry', e.target.value)}
              disabled={!isEditing}
              options={[
                { value: '', label: 'Select industry...' },
                { value: 'technology', label: 'Technology' },
                { value: 'finance', label: 'Finance' },
                { value: 'healthcare', label: 'Healthcare' },
                { value: 'education', label: 'Education' },
                { value: 'retail', label: 'Retail' },
                { value: 'manufacturing', label: 'Manufacturing' },
                { value: 'consulting', label: 'Consulting' },
                { value: 'media', label: 'Media & Entertainment' },
                { value: 'real_estate', label: 'Real Estate' },
                { value: 'hospitality', label: 'Hospitality' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </div>

          {/* Company Size */}
          <div className="mb-6">
            <Select
              label="Company Size"
              value={formData.companySize}
              onChange={(e) => handleInputChange('companySize', e.target.value)}
              disabled={!isEditing}
              options={[
                { value: '', label: 'Select company size...' },
                { value: '1-10', label: '1-10 employees' },
                { value: '11-50', label: '11-50 employees' },
                { value: '51-200', label: '51-200 employees' },
                { value: '201-500', label: '201-500 employees' },
                { value: '501-1000', label: '501-1000 employees' },
                { value: '1001-5000', label: '1001-5000 employees' },
                { value: '5000+', label: '5000+ employees' },
              ]}
            />
          </div>

          {/* Website */}
          <div className="mb-6">
            <Input
              label="Website"
              type="url"
              value={formData.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
              disabled={!isEditing}
              placeholder="https://www.example.com"
            />
          </div>

          {/* Location Section */}
          <div className="border-t pt-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Location</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="City"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                disabled={!isEditing}
                placeholder="San Francisco"
              />

              <Input
                label="State/Province"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                disabled={!isEditing}
                placeholder="CA"
              />
            </div>

            <div className="mt-4">
              <Input
                label="Country"
                value={formData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                disabled={!isEditing}
                placeholder="United States"
              />
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-3 pt-6 border-t">
              <Button
                onClick={handleSave}
                isLoading={isSaving}
                disabled={isSaving}
              >
                {hasCompany ? 'Save Changes' : 'Create Company Profile'}
              </Button>
              {hasCompany && (
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              )}
            </div>
          )}

          {/* Display metadata when viewing (not editing) */}
          {!isEditing && company && (
            <div className="pt-6 border-t text-sm text-gray-500">
              <p>Created: {new Date(company.createdAt).toLocaleDateString()}</p>
              {company.updatedAt && <p>Last Updated: {new Date(company.updatedAt).toLocaleDateString()}</p>}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};

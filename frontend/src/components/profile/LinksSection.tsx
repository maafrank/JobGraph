import { useState } from 'react';
import { Card, Button, Modal, Input, Select, useToast } from '../common';
import { profileService } from '../../services/profileService';
import type { ProfessionalLink } from '../../types';

interface LinksSectionProps {
  links: ProfessionalLink[];
  onUpdate: () => void;
}

export const LinksSection = ({ links, onUpdate }: LinksSectionProps) => {
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ProfessionalLink | null>(null);
  const [linkForm, setLinkForm] = useState({
    linkType: 'linkedin' as 'linkedin' | 'github' | 'portfolio' | 'website' | 'twitter' | 'other',
    url: '',
    label: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const linkTypeOptions = [
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'github', label: 'GitHub' },
    { value: 'portfolio', label: 'Portfolio' },
    { value: 'website', label: 'Website' },
    { value: 'twitter', label: 'Twitter' },
    { value: 'other', label: 'Other' },
  ];

  const getLinkIcon = (type: string) => {
    switch (type) {
      case 'linkedin':
        return '💼';
      case 'github':
        return '💻';
      case 'portfolio':
        return '🎨';
      case 'website':
        return '🌐';
      case 'twitter':
        return '🐦';
      default:
        return '🔗';
    }
  };

  const getLinkLabel = (link: ProfessionalLink) => {
    if (link.label) return link.label;
    return linkTypeOptions.find(opt => opt.value === link.linkType)?.label || link.linkType;
  };

  const handleOpenModal = (link?: ProfessionalLink) => {
    if (link) {
      setEditingLink(link);
      setLinkForm({
        linkType: link.linkType,
        url: link.url,
        label: link.label || '',
      });
    } else {
      setEditingLink(null);
      setLinkForm({
        linkType: 'linkedin',
        url: '',
        label: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLink(null);
    setLinkForm({ linkType: 'linkedin', url: '', label: '' });
  };

  const handleSaveLink = async () => {
    if (!linkForm.url) {
      toast.error('URL is required');
      return;
    }

    // Basic URL validation
    if (!/^https?:\/\/.+/.test(linkForm.url)) {
      toast.error('Please enter a valid URL (starting with http:// or https://)');
      return;
    }

    try {
      setIsSaving(true);
      if (editingLink) {
        await profileService.updateLink(editingLink.linkId, linkForm);
        toast.success('Link updated successfully');
      } else {
        await profileService.addLink(linkForm);
        toast.success('Link added successfully');
      }
      handleCloseModal();
      onUpdate();
    } catch (error: any) {
      toast.error(editingLink ? 'Failed to update link' : 'Failed to add link');
      console.error('Error saving link:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!window.confirm('Are you sure you want to delete this link?')) {
      return;
    }

    try {
      await profileService.deleteLink(linkId);
      toast.success('Link deleted successfully');
      onUpdate();
    } catch (error: any) {
      toast.error('Failed to delete link');
      console.error('Error deleting link:', error);
    }
  };

  return (
    <>
      <Card
        title="Professional Links"
        subtitle="Share your online presence"
      >
        {links && links.length > 0 ? (
          <div className="space-y-3">
            {links.map((link) => (
              <div
                key={link.linkId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className="text-2xl">{getLinkIcon(link.linkType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{getLinkLabel(link)}</p>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700 hover:underline truncate block"
                    >
                      {link.url}
                    </a>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenModal(link)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteLink(link.linkId)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">No professional links added yet</p>
            <p className="text-sm">Add your LinkedIn, GitHub, portfolio, or other professional profiles</p>
          </div>
        )}

        <div className="mt-6">
          <Button
            variant="secondary"
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto"
          >
            + Add Link
          </Button>
        </div>
      </Card>

      {/* Add/Edit Link Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingLink ? 'Edit Link' : 'Add Professional Link'}
      >
        <div className="space-y-4">
          <Select
            label="Link Type"
            value={linkForm.linkType}
            onChange={(e) =>
              setLinkForm({ ...linkForm, linkType: e.target.value as any })
            }
            options={linkTypeOptions}
            required
          />

          <Input
            label="URL"
            type="url"
            value={linkForm.url}
            onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
            placeholder="https://linkedin.com/in/yourprofile"
            required
          />

          <Input
            label="Custom Label (optional)"
            type="text"
            value={linkForm.label}
            onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })}
            placeholder="e.g., Personal Blog, Design Portfolio"
            helperText="Leave empty to use the link type as the label"
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveLink}
              isLoading={isSaving}
            >
              {editingLink ? 'Update' : 'Add'} Link
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default LinksSection;

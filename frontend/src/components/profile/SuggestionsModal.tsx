import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useToast } from '../common/Toast';
import { applySuggestion, rejectSuggestion, type Suggestion, type SuggestionsResponse } from '../../services/resumeService';

interface SuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: SuggestionsResponse;
}

export default function SuggestionsModal({ isOpen, onClose, suggestions }: SuggestionsModalProps) {
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const toast = useToast();

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: applySuggestion,
    onSuccess: (_, suggestionId) => {
      setAppliedIds((prev) => new Set(prev).add(suggestionId));
      toast.success('Suggestion applied successfully');
      // Invalidate profile queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['education'] });
      queryClient.invalidateQueries({ queryKey: ['workExperience'] });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
    onError: () => {
      toast.error('Failed to apply suggestion');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: rejectSuggestion,
    onSuccess: (_, suggestionId) => {
      setRejectedIds((prev) => new Set(prev).add(suggestionId));
      toast.success('Suggestion rejected');
    },
    onError: () => {
      toast.error('Failed to reject suggestion');
    },
  });

  const handleApply = (suggestionId: string) => {
    applyMutation.mutate(suggestionId);
  };

  const handleReject = (suggestionId: string) => {
    rejectMutation.mutate(suggestionId);
  };

  const handleClose = () => {
    // Refresh suggestions to remove applied/rejected ones
    queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    onClose();
  };

  const renderBasicInfoSuggestion = (suggestion: Suggestion) => {
    const data = suggestion.suggestedData;

    if (data.field === 'location') {
      return (
        <div>
          <span className="font-medium">Location:</span> {data.city}, {data.state}, {data.country}
        </div>
      );
    } else if (data.field === 'summary') {
      return (
        <div>
          <span className="font-medium">Summary:</span>
          <p className="mt-1 text-sm text-gray-600">{data.value}</p>
        </div>
      );
    }
    return null;
  };

  const renderEducationSuggestion = (suggestion: Suggestion) => {
    const data = suggestion.suggestedData;
    return (
      <div>
        <div className="font-medium">{data.degree}</div>
        <div className="text-sm text-gray-600">{data.institution}</div>
        {data.field_of_study && (
          <div className="text-sm text-gray-600">Field: {data.field_of_study}</div>
        )}
        {data.graduation_year && (
          <div className="text-sm text-gray-600">Year: {data.graduation_year}</div>
        )}
      </div>
    );
  };

  const renderWorkExperienceSuggestion = (suggestion: Suggestion) => {
    const data = suggestion.suggestedData;
    return (
      <div>
        <div className="font-medium">{data.title}</div>
        <div className="text-sm text-gray-600">{data.company}</div>
        {data.start_date && (
          <div className="text-sm text-gray-600">
            {data.start_date} - {data.end_date || 'Present'}
          </div>
        )}
        {data.description && (
          <p className="mt-1 text-sm text-gray-600">{data.description}</p>
        )}
      </div>
    );
  };

  const renderSkillSuggestion = (suggestion: Suggestion) => {
    const data = suggestion.suggestedData;
    return (
      <div>
        <span className="font-medium">{data.skill_name}</span>
        <span className="ml-2 text-sm text-gray-500">
          (Confidence: {Math.round(data.confidence * 100)}%)
        </span>
      </div>
    );
  };

  const renderSuggestionGroup = (
    title: string,
    suggestions: Suggestion[],
    renderFn: (suggestion: Suggestion) => React.ReactNode
  ) => {
    if (suggestions.length === 0) return null;

    const visibleSuggestions = suggestions.filter(
      (s) => !appliedIds.has(s.suggestionId) && !rejectedIds.has(s.suggestionId)
    );

    if (visibleSuggestions.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
        <div className="space-y-3">
          {visibleSuggestions.map((suggestion) => (
            <div
              key={suggestion.suggestionId}
              className="border border-gray-200 rounded-lg p-4 bg-white"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">{renderFn(suggestion)}</div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApply(suggestion.suggestionId)}
                    isLoading={applyMutation.isPending}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleReject(suggestion.suggestionId)}
                    isLoading={rejectMutation.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const totalVisible =
    suggestions.suggestions.basic_info.filter((s) => !appliedIds.has(s.suggestionId) && !rejectedIds.has(s.suggestionId)).length +
    suggestions.suggestions.education.filter((s) => !appliedIds.has(s.suggestionId) && !rejectedIds.has(s.suggestionId)).length +
    suggestions.suggestions.work_experience.filter((s) => !appliedIds.has(s.suggestionId) && !rejectedIds.has(s.suggestionId)).length +
    suggestions.suggestions.skills.filter((s) => !appliedIds.has(s.suggestionId) && !rejectedIds.has(s.suggestionId)).length;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Resume Auto-fill Suggestions</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {totalVisible === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">All suggestions processed!</h3>
            <p className="mt-1 text-sm text-gray-500">
              You've reviewed all suggestions from your resume.
            </p>
            <Button variant="primary" onClick={handleClose} className="mt-4">
              Close
            </Button>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-gray-600 mb-4">
              We found {totalVisible} suggestion{totalVisible !== 1 ? 's' : ''} from your resume.
              Review and apply them to quickly fill your profile.
            </p>

            {renderSuggestionGroup(
              'Basic Information',
              suggestions.suggestions.basic_info,
              renderBasicInfoSuggestion
            )}

            {renderSuggestionGroup(
              'Education',
              suggestions.suggestions.education,
              renderEducationSuggestion
            )}

            {renderSuggestionGroup(
              'Work Experience',
              suggestions.suggestions.work_experience,
              renderWorkExperienceSuggestion
            )}

            {renderSuggestionGroup(
              'Skills',
              suggestions.suggestions.skills,
              renderSkillSuggestion
            )}
          </div>
        )}

        {totalVisible > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
            <Button variant="secondary" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

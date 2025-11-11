import { useEffect, useState } from 'react';
import { Layout } from '../../components/layout';
import { Card, Button, Input, LoadingSpinner, Modal, useToast } from '../../components/common';
import { skillsService } from '../../services/skillsService';
import { profileService } from '../../services/profileService';
import type { Skill, UserSkillScore } from '../../types';

export const SkillsPage = () => {
  const toast = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<'browse' | 'myskills'>('myskills');

  // My Skills state
  const [mySkills, setMySkills] = useState<UserSkillScore[]>([]);
  const [isLoadingMySkills, setIsLoadingMySkills] = useState(true);

  // Browse Skills state
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);

  // Add/Edit Skill Modal state
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [editingSkillScore, setEditingSkillScore] = useState<UserSkillScore | null>(null);
  const [skillScore, setSkillScore] = useState(50);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch my skills on mount
  useEffect(() => {
    fetchMySkills();
    fetchCategories();
  }, []);

  // Fetch all skills when tab changes to browse or filters change
  useEffect(() => {
    if (activeTab === 'browse') {
      fetchAllSkills();
    }
  }, [activeTab, selectedCategory, searchQuery]);

  const fetchMySkills = async () => {
    try {
      setIsLoadingMySkills(true);
      const data = await profileService.getSkills();
      setMySkills(data);
    } catch (error: any) {
      toast.error('Failed to load your skills');
      console.error('Error fetching skills:', error);
    } finally {
      setIsLoadingMySkills(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await skillsService.getCategories();
      setCategories(data);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchAllSkills = async () => {
    try {
      setIsLoadingSkills(true);
      const { skills } = await skillsService.getSkills({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        search: searchQuery || undefined,
        active: true,
      });
      setAllSkills(skills);
    } catch (error: any) {
      toast.error('Failed to load skills');
      console.error('Error fetching skills:', error);
    } finally {
      setIsLoadingSkills(false);
    }
  };

  const handleAddSkill = (skill: Skill) => {
    // Check if user already has this skill
    const existingSkill = mySkills.find((s) => s.skill_id === skill.skill_id);
    if (existingSkill) {
      toast.info('You already have this skill. Edit it from My Skills tab.');
      return;
    }

    setSelectedSkill(skill);
    setEditingSkillScore(null);
    setSkillScore(50);
    setIsSkillModalOpen(true);
  };

  const handleEditSkill = (userSkill: UserSkillScore) => {
    setEditingSkillScore(userSkill);
    setSelectedSkill(null);
    setSkillScore(userSkill.score);
    setIsSkillModalOpen(true);
  };

  const handleSaveSkill = async () => {
    try {
      setIsSaving(true);

      if (editingSkillScore) {
        // Update existing skill
        await profileService.updateSkill(editingSkillScore.skill_id, skillScore);
        toast.success('Skill score updated successfully');
      } else if (selectedSkill) {
        // Add new skill
        await profileService.addSkill({
          skillId: selectedSkill.skill_id,
          score: skillScore,
        });
        toast.success('Skill added successfully');
      }

      await fetchMySkills(); // Refresh the list
      setIsSkillModalOpen(false);
      setSelectedSkill(null);
      setEditingSkillScore(null);
    } catch (error: any) {
      toast.error('Failed to save skill');
      console.error('Error saving skill:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm('Are you sure you want to remove this skill?')) {
      return;
    }

    try {
      await profileService.deleteSkill(skillId);
      toast.success('Skill removed successfully');
      await fetchMySkills(); // Refresh the list
    } catch (error: any) {
      toast.error('Failed to remove skill');
      console.error('Error deleting skill:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Expert';
    if (score >= 60) return 'Advanced';
    if (score >= 40) return 'Intermediate';
    return 'Beginner';
  };

  if (isLoadingMySkills) {
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Skills Management</h1>
          <p className="text-gray-600 mt-2">
            Add and manage your skills to improve job matching
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-4">
            <button
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'myskills'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('myskills')}
            >
              My Skills ({mySkills.length})
            </button>
            <button
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'browse'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('browse')}
            >
              Browse Skills
            </button>
          </div>
        </div>

        {/* My Skills Tab */}
        {activeTab === 'myskills' && (
          <Card>
            <div className="space-y-4">
              {mySkills.length > 0 ? (
                <div className="grid gap-4">
                  {mySkills.map((skill) => (
                    <div
                      key={skill.user_skill_id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-medium text-gray-900">
                              {skill.skill_name}
                            </h3>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              {skill.category}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-4">
                            <div>
                              <span className="text-sm text-gray-600">Score: </span>
                              <span className={`text-lg font-bold ${getScoreColor(skill.score)}`}>
                                {skill.score}
                              </span>
                              <span className="text-sm text-gray-500 ml-2">
                                ({getScoreLabel(skill.score)})
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-gray-500">
                            Added: {formatDate(skill.acquired_at)}
                            {skill.expires_at && (
                              <> • Expires: {formatDate(skill.expires_at)}</>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSkill(skill)}
                          >
                            Edit Score
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteSkill(skill.skill_id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">No skills added yet</p>
                  <Button variant="primary" onClick={() => setActiveTab('browse')}>
                    Browse Skills
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Browse Skills Tab */}
        {activeTab === 'browse' && (
          <>
            {/* Filters */}
            <Card>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Categories</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search
                    </label>
                    <Input
                      type="text"
                      placeholder="Search skills..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Skills Grid */}
            <Card>
              {isLoadingSkills ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" />
                </div>
              ) : allSkills.length > 0 ? (
                <div className="grid gap-4">
                  {allSkills.map((skill) => {
                    const hasSkill = mySkills.some((s) => s.skill_id === skill.skill_id);
                    return (
                      <div
                        key={skill.skill_id}
                        className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg font-medium text-gray-900">
                                {skill.skill_name}
                              </h3>
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                {skill.category}
                              </span>
                              {hasSkill && (
                                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                                  Added
                                </span>
                              )}
                            </div>
                            {skill.description && (
                              <p className="text-sm text-gray-600 mt-1">{skill.description}</p>
                            )}
                          </div>
                          <div className="ml-4">
                            <Button
                              variant={hasSkill ? 'ghost' : 'primary'}
                              size="sm"
                              onClick={() => handleAddSkill(skill)}
                              disabled={hasSkill}
                            >
                              {hasSkill ? 'Added' : 'Add Skill'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No skills found</p>
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {/* Add/Edit Skill Modal */}
      <Modal
        isOpen={isSkillModalOpen}
        onClose={() => {
          setIsSkillModalOpen(false);
          setSelectedSkill(null);
          setEditingSkillScore(null);
        }}
        title={editingSkillScore ? 'Edit Skill Score' : 'Add Skill'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Skill
            </label>
            <p className="text-lg font-medium text-gray-900">
              {editingSkillScore?.skill_name || selectedSkill?.skill_name}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Score (0-100)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={skillScore}
              onChange={(e) => setSkillScore(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-2xl font-bold ${getScoreColor(skillScore)}`}>
                {skillScore}
              </span>
              <span className="text-sm text-gray-600">
                {getScoreLabel(skillScore)}
              </span>
            </div>
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
            <p className="font-medium mb-1">Score Guidelines:</p>
            <ul className="space-y-1 text-xs">
              <li>0-39: Beginner - Basic knowledge</li>
              <li>40-59: Intermediate - Working proficiency</li>
              <li>60-79: Advanced - Strong expertise</li>
              <li>80-100: Expert - Master level</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              onClick={handleSaveSkill}
              isLoading={isSaving}
              className="flex-1"
            >
              {editingSkillScore ? 'Update Score' : 'Add Skill'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsSkillModalOpen(false);
                setSelectedSkill(null);
                setEditingSkillScore(null);
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

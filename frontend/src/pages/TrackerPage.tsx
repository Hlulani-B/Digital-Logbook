import React, { useEffect, useState } from 'react';
import { getProjectProgress, type ProjectProgress } from '../lib/progressApi';
import { ProgressBar } from '../components/ProgressBar';
import { useNavigate } from 'react-router-dom';

const TrackerPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProjectProgress();
      if (response.success && response.data) {
        setProjects(response.data);
      } else {
        setError(response.message || 'Failed to load progress data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading progress data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-500 mb-4">No projects found</div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Project Tracker</h1>
        <button
          onClick={loadProgress}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div
            key={project.project_name}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            {/* Project Header */}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{project.project_name}</h2>
              <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                {project.project_status || 'active'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <ProgressBar percentage={project.completion_percentage} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="bg-gray-50 rounded p-2">
                <div className="text-lg font-bold text-gray-900">{project.total_entries}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="bg-green-50 rounded p-2">
                <div className="text-lg font-bold text-green-600">{project.completed_entries}</div>
                <div className="text-xs text-gray-500">Done</div>
              </div>
              <div className="bg-red-50 rounded p-2">
                <div className="text-lg font-bold text-red-600">{project.overdue_entries}</div>
                <div className="text-xs text-gray-500">Overdue</div>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            {project.upcoming_deadlines.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Upcoming Deadlines</h3>
                <div className="space-y-2">
                  {project.upcoming_deadlines.slice(0, 3).map((deadline) => {
                    const daysUntil = getDaysUntilDue(deadline.due_date);
                    const isUrgent = daysUntil !== null && daysUntil <= 2;
                    return (
                      <div
                        key={deadline.id}
                        className={`text-xs p-2 rounded ${
                          isUrgent ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-gray-900 truncate flex-1">
                            {deadline.summary || 'Untitled'}
                          </span>
                          <span
                            className={`ml-2 px-1.5 py-0.5 rounded text-xs ${getPriorityColor(
                              deadline.priority
                            )}`}
                          >
                            {deadline.priority || 'normal'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-gray-500">{formatDate(deadline.due_date)}</span>
                          {daysUntil !== null && (
                            <span
                              className={`text-xs ${
                                daysUntil < 0
                                  ? 'text-red-600 font-medium'
                                  : daysUntil <= 2
                                    ? 'text-orange-600'
                                    : 'text-gray-500'
                              }`}
                            >
                              {daysUntil < 0
                                ? `${Math.abs(daysUntil)}d overdue`
                                : daysUntil === 0
                                  ? 'Due today'
                                  : `${daysUntil}d left`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            {project.recent_activity.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Activity</h3>
                <div className="space-y-1">
                  {project.recent_activity.slice(0, 3).map((activity) => (
                    <div key={activity.id} className="text-xs text-gray-600 truncate">
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-1 ${
                          activity.status === 'completed'
                            ? 'bg-green-500'
                            : activity.status === 'overdue'
                              ? 'bg-red-500'
                              : 'bg-blue-500'
                        }`}
                      />
                      {activity.summary || 'Untitled entry'}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrackerPage;

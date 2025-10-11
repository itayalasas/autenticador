import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  Bookmark,
  BookmarkCheck,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { deploymentSnapshotService, DeploymentSnapshot } from '../../services/deploymentSnapshotService';
import { deploymentLogService } from '../../services/deploymentLogService';
import { applicationService } from '../../services/applicationService';
import { useNotification } from '../../hooks/useNotification';
import ConfirmationModal from '../ui/ConfirmationModal';
import { Application } from '../../types';

interface DeploymentManagerProps {
  applicationId?: string;
}

export default function DeploymentManager({ applicationId }: DeploymentManagerProps) {
  const { showSuccess, showError } = useNotification();
  const [snapshots, setSnapshots] = useState<DeploymentSnapshot[]>([]);
  const [deploymentLogs, setDeploymentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollbackingId, setRollbackingId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<DeploymentSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<'snapshots' | 'logs'>('snapshots');
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | undefined>(applicationId);

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadData();
    }
  }, [selectedApp]);

  const loadApplications = async () => {
    try {
      const apps = await applicationService.getApplications();
      setApplications(apps);

      // If we have an applicationId prop, use it
      if (applicationId) {
        setSelectedApp(applicationId);
      } else if (apps.length === 1) {
        // If there's only one app, auto-select it
        setSelectedApp(apps[0].id);
        sessionStorage.setItem('selectedAppId', apps[0].id);
      }
    } catch (error: any) {
      showError(error.message || 'Error loading applications');
    }
  };

  const loadData = async () => {
    if (!selectedApp) return;

    try {
      setLoading(true);
      const [snapshotsData, logsData] = await Promise.all([
        deploymentSnapshotService.getSnapshots(selectedApp),
        deploymentLogService.getDeploymentLogs(selectedApp),
      ]);
      setSnapshots(snapshotsData);
      setDeploymentLogs(logsData);
    } catch (error: any) {
      showError(error.message || 'Error loading deployment data');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedSnapshot || !selectedApp) return;

    try {
      setRollbackingId(selectedSnapshot.id);
      const result = await deploymentSnapshotService.rollbackToSnapshot(
        selectedSnapshot.id,
        selectedApp
      );

      showSuccess(result.message);
      setShowConfirmModal(false);
      setSelectedSnapshot(null);
      await loadData();
    } catch (error: any) {
      showError(error.message || 'Failed to rollback deployment');
    } finally {
      setRollbackingId(null);
    }
  };

  const handleMarkAsStable = async (snapshotId: string) => {
    try {
      await deploymentSnapshotService.markAsStable(snapshotId);
      showSuccess('Snapshot marked as stable');
      await loadData();
    } catch (error: any) {
      showError(error.message || 'Failed to mark as stable');
    }
  };

  const handleMarkAsUnstable = async (snapshotId: string) => {
    try {
      await deploymentSnapshotService.markAsUnstable(snapshotId);
      showSuccess('Snapshot marked as unstable');
      await loadData();
    } catch (error: any) {
      showError(error.message || 'Failed to mark as unstable');
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    if (!confirm('Are you sure you want to delete this snapshot?')) return;

    try {
      await deploymentSnapshotService.deleteSnapshot(snapshotId);
      showSuccess('Snapshot deleted');
      await loadData();
    } catch (error: any) {
      showError(error.message || 'Failed to delete snapshot');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'stable':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'unstable':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'rolled_back':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'stable':
        return <CheckCircle className="w-4 h-4" />;
      case 'unstable':
        return <XCircle className="w-4 h-4" />;
      case 'rolled_back':
        return <RotateCcw className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // Show application selector if no app is selected
  if (!selectedApp && applications.length > 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Selecciona una aplicación</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {applications.map((app) => (
            <button
              key={app.id}
              onClick={() => {
                setSelectedApp(app.id);
                sessionStorage.setItem('selectedAppId', app.id);
              }}
              className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">{app.name}</h4>
                <p className="text-sm text-gray-500 truncate">{app.domain || 'No domain'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Application selector header */}
      {applications.length > 1 && selectedApp && (
        <div className="px-6 py-4 border-b border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Aplicación actual:
          </label>
          <select
            value={selectedApp}
            onChange={(e) => {
              setSelectedApp(e.target.value);
              sessionStorage.setItem('selectedAppId', e.target.value);
            }}
            className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4 px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`py-4 px-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'snapshots'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Bookmark className="w-4 h-4" />
              <span>Deployment Snapshots</span>
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {snapshots.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-4 px-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Deployment History</span>
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {deploymentLogs.length}
              </span>
            </div>
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'snapshots' ? (
          <div className="space-y-4">
            {snapshots.length === 0 ? (
              <div className="text-center py-12">
                <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Snapshots Yet</h3>
                <p className="text-gray-600">
                  Deployment snapshots will appear here after your first deployment.
                </p>
              </div>
            ) : (
              snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <GitBranch className="w-5 h-5 text-gray-400" />
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {snapshot.commit_hash.substring(0, 7)}
                        </code>
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            snapshot.status
                          )}`}
                        >
                          {getStatusIcon(snapshot.status)}
                          <span className="capitalize">{snapshot.status}</span>
                        </span>
                        {snapshot.branch && (
                          <span className="text-xs text-gray-500">on {snapshot.branch}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{snapshot.commit_message}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(snapshot.deployed_at)}</span>
                        </div>
                        {snapshot.deployment_url && (
                          <a
                            href={snapshot.deployment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>View Deployment</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      {snapshot.status !== 'stable' && (
                        <button
                          onClick={() => handleMarkAsStable(snapshot.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Mark as stable"
                        >
                          <BookmarkCheck className="w-4 h-4" />
                        </button>
                      )}
                      {snapshot.status === 'stable' && (
                        <button
                          onClick={() => handleMarkAsUnstable(snapshot.id)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                          title="Mark as unstable"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedSnapshot(snapshot);
                          setShowConfirmModal(true);
                        }}
                        disabled={rollbackingId === snapshot.id}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Rollback to this version"
                      >
                        {rollbackingId === snapshot.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snapshot.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {deploymentLogs.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Deployment Logs</h3>
                <p className="text-gray-600">Deployment history will appear here.</p>
              </div>
            ) : (
              deploymentLogs.map((log) => (
                <div
                  key={log.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      {log.status === 'success' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : log.status === 'failed' ? (
                        <XCircle className="w-5 h-5 text-red-500" />
                      ) : (
                        <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{log.message}</p>
                        <p className="text-xs text-gray-500">{formatDate(log.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedSnapshot && (
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setSelectedSnapshot(null);
          }}
          onConfirm={handleRollback}
          title="Rollback Deployment"
          message={
            <div className="space-y-3">
              <p>
                Are you sure you want to rollback to this deployment? This will:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Reset your code to commit {selectedSnapshot.commit_hash.substring(0, 7)}</li>
                <li>Trigger a new deployment with the previous code</li>
                <li>Create a snapshot of the current state</li>
              </ul>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This operation cannot be undone. Make sure you have backups
                  if needed.
                </p>
              </div>
            </div>
          }
          confirmText="Rollback"
          confirmButtonClass="bg-blue-600 hover:bg-blue-700 text-white"
        />
      )}
    </div>
  );
}

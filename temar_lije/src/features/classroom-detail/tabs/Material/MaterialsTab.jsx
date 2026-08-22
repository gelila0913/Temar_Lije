import React, { useState, useEffect, useCallback } from 'react';
import { Search, Upload, FileText, Download, Loader2, X, Eye, BookOpen } from 'lucide-react';
import { getMaterials, uploadMaterial, getFileUrl } from '../../../../services/apiClient';
import './MaterialsTab.css';

export default function MaterialsTab({
  classId = '66666666-6666-4666-8666-666666666666',
  isTeacher = false,
  _currentUser,
  _onUploadMaterial,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMaterials(classId);
      setMaterials(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Could not load course materials.');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const handleOpenUpload = () => {
    if (onUploadMaterial) {
      onUploadMaterial();
    } else {
      setShowUploadModal(true);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !selectedFile) {
      setUploadError('Title and file are required.');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('title', uploadTitle.trim());
      formData.append('description', uploadDescription.trim());
      formData.append('classId', classId);
      formData.append('file', selectedFile);

      await uploadMaterial(formData);
      setShowUploadModal(false);
      setUploadTitle('');
      setUploadDescription('');
      setSelectedFile(null);
      await loadMaterials();
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredMaterials = materials.filter((m) =>
    (m.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="classroom-detail-container">
      {/* Search & Actions Bar */}
      <div className="materials-action-row">
        <div className="materials-search-container">
          <Search className="materials-search-icon" />
          <input
            type="text"
            className="materials-search-input"
            placeholder="Search materials by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {isTeacher && (
          <button className="materials-upload-btn" onClick={handleOpenUpload}>
            <Upload className="materials-upload-icon" />
            Upload material
          </button>
        )}
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>}

      {/* Loading & Empty State */}
      {loading ? (
        <div className="materials-empty-state-card">
          <Loader2 className="materials-spinner animate-spin" style={{ margin: '0 auto 1rem' }} />
          <p className="materials-empty-state-text">Loading course materials...</p>
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="materials-empty-state-card">
          <BookOpen size={40} style={{ opacity: 0.5, marginBottom: '12px' }} />
          <p className="materials-empty-state-text">
            {isTeacher
              ? 'No materials yet. Upload PDFs, slides, documents or images for this class.'
              : 'No materials uploaded yet. Your teacher will share lesson notes and slides here.'}
          </p>
        </div>
      ) : (
        /* Materials List Grid */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {filteredMaterials.map((item) => {
            const downloadLink = getFileUrl(item.fileUrl || item.filePath);
            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e3e9e6',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: '#e0f2fe',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '600', color: '#16181b' }}>
                      {item.title}
                    </h4>
                    {item.fileType && (
                      <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{item.fileType}</span>
                    )}
                  </div>
                </div>

                {downloadLink && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      href={downloadLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        backgroundColor: '#ffffff',
                        color: '#374151',
                        fontWeight: 500,
                        fontSize: '0.85rem',
                        textDecoration: 'none',
                      }}
                    >
                      <Eye size={14} /> View
                    </a>
                    <a
                      href={downloadLink}
                      download
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#14785c',
                        color: '#ffffff',
                        fontWeight: 500,
                        fontSize: '0.85rem',
                        textDecoration: 'none',
                      }}
                    >
                      <Download size={14} /> Download
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Material Modal */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '480px',
              padding: '24px',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setShowUploadModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#16181b' }}>Upload Course Material</h3>

            {uploadError && <p style={{ color: '#dc2626', fontSize: '14px' }}>{uploadError}</p>}

            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Chapter 1 Slides"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Description (optional)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Additional context or notes"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  File *
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  style={{ fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#14785c',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
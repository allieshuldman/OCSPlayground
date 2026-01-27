import { useState, useEffect, useMemo } from 'react'
import JsonView from '@uiw/react-json-view'
import './Analysis.css'

function Analysis() {
  const [saves, setSaves] = useState([])
  const [viewMode, setViewMode] = useState('default') // 'default', 'viewAll', 'compareEmails', 'comparePrompts'
  const [selectedSave, setSelectedSave] = useState(null)
  const [selectedSaves, setSelectedSaves] = useState([]) // For multi-select comparison
  const [renamingSave, setRenamingSave] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [showSavesList, setShowSavesList] = useState(true) // Collapsible saves list
  const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState(false) // Fully collapse left pane
  const [layoutDirection, setLayoutDirection] = useState('horizontal') // 'horizontal' or 'vertical' for comparison views
  
  // Filters for comparison views
  const [selectedTemplateName, setSelectedTemplateName] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState('')

  useEffect(() => {
    // Load saves from localStorage
    try {
      const stored = localStorage.getItem('playgroundSaves')
      if (stored) {
        const parsedSaves = JSON.parse(stored)
        setSaves(parsedSaves.reverse()) // Most recent first
      }
    } catch (err) {
      console.error('Error loading saves:', err)
    }
  }, [])

  // Get unique template names from saves
  const templateNames = useMemo(() => {
    const names = new Set()
    saves.forEach(save => {
      const templateName = save.template?.name
      if (templateName) {
        names.add(templateName)
      }
    })
    return Array.from(names).sort()
  }, [saves])

  // Get unique conversationIds with subjects from saves
  const conversationIds = useMemo(() => {
    const map = new Map()
    saves.forEach(save => {
      const requestBody = save.experimentApiRequest?.body
      if (requestBody?.ConversationId) {
        const conversationId = requestBody.ConversationId
        if (!map.has(conversationId)) {
          // Try to find subject from emailDetails first, then output, then request
          const subject = save.emailDetails?.subject || save.output?.subject || requestBody?.Subject || 'No Subject'
          map.set(conversationId, subject)
        }
      }
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [saves])

  // Filter saves based on selected template name
  const filteredSavesByTemplate = useMemo(() => {
    if (!selectedTemplateName) return []
    return saves.filter(save => save.template?.name === selectedTemplateName)
  }, [saves, selectedTemplateName])

  // Filter saves based on selected conversationId
  const filteredSavesByConversationId = useMemo(() => {
    if (!selectedConversationId) return []
    return saves.filter(save => {
      const requestBody = save.experimentApiRequest?.body
      return requestBody?.ConversationId === selectedConversationId
    })
  }, [saves, selectedConversationId])

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleString()
    } catch {
      return timestamp
    }
  }

  const handleDeleteSave = (index) => {
    if (window.confirm('Are you sure you want to delete this save?')) {
      const updatedSaves = saves.filter((_, i) => i !== index)
      setSaves(updatedSaves)
      // Reverse to store in chronological order (oldest first)
      localStorage.setItem('playgroundSaves', JSON.stringify([...updatedSaves].reverse()))
      if (selectedSave === index) {
        setSelectedSave(null)
      } else if (selectedSave > index) {
        setSelectedSave(selectedSave - 1)
      }
      // Update selectedSaves indices
      setSelectedSaves(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i))
    }
  }

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all saves?')) {
      setSaves([])
      setSelectedSave(null)
      setSelectedSaves([])
      localStorage.removeItem('playgroundSaves')
    }
  }

  const handleStartRename = (index, e) => {
    e.stopPropagation()
    const save = saves[index]
    const currentName = save.name || save.template?.name || 'Untitled Template'
    setRenamingSave(index)
    setRenameValue(currentName)
  }

  const handleCancelRename = () => {
    setRenamingSave(null)
    setRenameValue('')
  }

  const handleSaveRename = (index, e) => {
    if (e) {
      e.stopPropagation()
    }
    
    if (!renameValue.trim()) {
      alert('Name cannot be empty')
      return
    }
    
    const updatedSaves = [...saves]
    updatedSaves[index] = {
      ...updatedSaves[index],
      name: renameValue.trim()
    }
    setSaves(updatedSaves)
    // Reverse to store in chronological order (oldest first)
    localStorage.setItem('playgroundSaves', JSON.stringify([...updatedSaves].reverse()))
    setRenamingSave(null)
    setRenameValue('')
  }

  const handleToggleSaveSelection = (index) => {
    setSelectedSaves(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index)
      } else {
        // Limit to maximum 5 selections
        if (prev.length >= 5) {
          alert('Maximum 5 saved runs can be selected for comparison')
          return prev
        }
        return [...prev, index]
      }
    })
  }

  const handleBackToDefault = () => {
    setViewMode('default')
    setSelectedTemplateName('')
    setSelectedConversationId('')
    setSelectedSaves([])
    setSelectedSave(null)
  }

  // Render default three-tile view
  const renderDefaultView = () => (
    <div className="analysis-tiles-container">
      <div className="analysis-tile" onClick={() => setViewMode('viewAll')}>
        <h3>View All</h3>
        <p>View all saved runs</p>
      </div>
      <div className="analysis-tile" onClick={() => setViewMode('compareEmails')}>
        <h3>Compare Emails for Same Prompt</h3>
        <p>Compare different emails using the same template</p>
      </div>
      <div className="analysis-tile" onClick={() => setViewMode('comparePrompts')}>
        <h3>Compare Prompts for Same Email</h3>
        <p>Compare different templates for the same email</p>
      </div>
    </div>
  )

  // Render View All (current UI)
  const renderViewAll = () => {
    const displaySaves = saves
    return (
      <div className={`analysis-layout ${isLeftPaneCollapsed ? 'left-pane-collapsed' : ''}`}>
        <div className={`saves-list ${isLeftPaneCollapsed ? 'collapsed' : ''}`}>
          {!isLeftPaneCollapsed ? (
            <>
              <div 
                className="saves-list-header"
                onClick={() => setShowSavesList(!showSavesList)}
              >
                <h3>Saved Runs ({displaySaves.length})</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="saves-list-toggle">
                    {showSavesList ? '▼' : '▶'}
                  </span>
                  <button
                    className="collapse-pane-button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsLeftPaneCollapsed(true)
                    }}
                    title="Collapse pane"
                  >
                    ◀
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="saves-list-header">
              <button
                className="expand-pane-button"
                onClick={() => setIsLeftPaneCollapsed(false)}
                title="Expand pane"
              >
                ▶
              </button>
            </div>
          )}
          {showSavesList && (
          <div className="saves-list-items">
            {displaySaves.map((save, index) => (
              <div 
                key={index}
                className={`save-item ${selectedSave === index ? 'selected' : ''}`}
                onClick={() => setSelectedSave(selectedSave === index ? null : index)}
              >
                <div className="save-item-header">
                  <div className="save-item-title">
                    {renamingSave === index ? (
                      <input
                        type="text"
                        className="rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={(e) => {
                          if (!e.relatedTarget || (!e.relatedTarget.classList.contains('save-rename-button') && !e.relatedTarget.classList.contains('cancel-rename-button'))) {
                            handleSaveRename(index)
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleSaveRename(index)
                          } else if (e.key === 'Escape') {
                            handleCancelRename()
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <>
                        <strong>{save.name || save.template?.name || 'Untitled Template'}</strong>
                        <span className="save-item-timestamp">{formatTimestamp(save.timestamp)}</span>
                      </>
                    )}
                  </div>
                  <div className="save-item-actions">
                    {renamingSave === index ? (
                      <>
                        <button
                          className="save-rename-button"
                          onClick={(e) => handleSaveRename(index, e)}
                          onMouseDown={(e) => e.preventDefault()}
                          title="Save rename"
                        >
                          ✓
                        </button>
                        <button
                          className="cancel-rename-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelRename()
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                          title="Cancel rename"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="rename-save-button"
                          onClick={(e) => handleStartRename(index, e)}
                          title="Rename this save"
                        >
                          ✎
                        </button>
                        <button
                          className="delete-save-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSave(index)
                          }}
                          title="Delete this save"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
        <div className="save-details">
          {selectedSave !== null && saves[selectedSave] ? (
            <div className="save-details-content">
              <h3>Save Details</h3>
              <div className="save-details-section notes-section">
                <h4>Notes</h4>
                <textarea
                  className="save-notes-textarea"
                  value={saves[selectedSave].notes || ''}
                  onChange={(e) => {
                    const updatedSaves = [...saves]
                    updatedSaves[selectedSave] = {
                      ...updatedSaves[selectedSave],
                      notes: e.target.value
                    }
                    setSaves(updatedSaves)
                    localStorage.setItem('playgroundSaves', JSON.stringify([...updatedSaves].reverse()))
                  }}
                  placeholder="Add notes about this saved run..."
                  rows={4}
                />
              </div>
              <div className="save-details-section">
                <h4>Template</h4>
                <div className="save-details-field">
                  <strong>Save Name:</strong> {saves[selectedSave].name || saves[selectedSave].template?.name || 'N/A'}
                </div>
                <div className="save-details-field">
                  <strong>Template Name:</strong> {saves[selectedSave].template?.name || 'N/A'}
                </div>
                <div className="save-details-field">
                  <strong>Content:</strong>
                  <pre className="save-details-pre">{saves[selectedSave].template?.content || 'N/A'}</pre>
                </div>
                {saves[selectedSave].template?.conditionFlags?.length > 0 && (
                  <div className="save-details-field">
                    <strong>Condition Flags:</strong>
                    <JsonView value={saves[selectedSave].template.conditionFlags} />
                  </div>
                )}
                {saves[selectedSave].template?.parametersValues && Object.keys(saves[selectedSave].template.parametersValues).length > 0 && (
                  <div className="save-details-field">
                    <strong>Parameter Values:</strong>
                    <JsonView value={saves[selectedSave].template.parametersValues} />
                  </div>
                )}
              </div>
              {Object.keys(saves[selectedSave].subTemplates || {}).length > 0 && (
                <div className="save-details-section">
                  <h4>SubTemplates</h4>
                  <JsonView value={saves[selectedSave].subTemplates} />
                </div>
              )}
              {saves[selectedSave].emailDetails && (
                <div className="save-details-section">
                  <h4>Email Details</h4>
                  <JsonView value={saves[selectedSave].emailDetails} />
                </div>
              )}
              <div className="save-details-section">
                <h4>Experiment API Request</h4>
                <div className="save-details-field">
                  <strong>URL:</strong> {saves[selectedSave].experimentApiRequest?.url || 'N/A'}
                </div>
                <div className="save-details-field">
                  <strong>Method:</strong> {saves[selectedSave].experimentApiRequest?.method || 'N/A'}
                </div>
                <div className="save-details-field">
                  <strong>Request Body:</strong>
                  <JsonView value={saves[selectedSave].experimentApiRequest?.body || {}} />
                </div>
              </div>
              {saves[selectedSave].output && (
                <div className="save-details-section">
                  <h4>Output</h4>
                  <JsonView value={saves[selectedSave].output} />
                </div>
              )}
            </div>
          ) : (
            <div className="no-selection-message">
              <p>Select a save from the list to view its details.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render Compare Emails for Same Prompt
  const renderCompareEmails = () => {
    const displaySaves = filteredSavesByTemplate
    
    return (
      <div className="compare-view">
        <div className="compare-filter-section">
          <label htmlFor="template-filter">Select Template:</label>
          <select
            id="template-filter"
            value={selectedTemplateName}
            onChange={(e) => {
              setSelectedTemplateName(e.target.value)
              setSelectedSaves([])
            }}
            className="compare-filter-select"
          >
            <option value="">-- Select a template --</option>
            {templateNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {selectedTemplateName && (
            <button
              className="layout-toggle-button"
              onClick={() => setLayoutDirection(layoutDirection === 'horizontal' ? 'vertical' : 'horizontal')}
              title={`Switch to ${layoutDirection === 'horizontal' ? 'vertical' : 'horizontal'} layout`}
            >
              {layoutDirection === 'horizontal' ? '⇄ Horizontal' : '⇅ Vertical'}
            </button>
          )}
        </div>
        
        {selectedTemplateName && (
          <>
            <div className={`analysis-layout ${isLeftPaneCollapsed ? 'left-pane-collapsed' : ''}`}>
              <div className={`saves-list ${isLeftPaneCollapsed ? 'collapsed' : ''}`}>
                {!isLeftPaneCollapsed ? (
                  <>
                    <div 
                      className="saves-list-header"
                      onClick={() => setShowSavesList(!showSavesList)}
                    >
                      <h3>Saved Runs for "{selectedTemplateName}" ({displaySaves.length}) {selectedSaves.length > 0 && `(${selectedSaves.length}/5 selected)`}</h3>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="saves-list-toggle">
                          {showSavesList ? '▼' : '▶'}
                        </span>
                        <button
                          className="collapse-pane-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsLeftPaneCollapsed(true)
                          }}
                          title="Collapse pane"
                        >
                          ◀
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="saves-list-header">
                    <button
                      className="expand-pane-button"
                      onClick={() => setIsLeftPaneCollapsed(false)}
                      title="Expand pane"
                    >
                      ▶
                    </button>
                  </div>
                )}
                {showSavesList && (
                <div className="saves-list-items">
                {displaySaves.map((save, idx) => {
                  const originalIndex = saves.indexOf(save)
                  const isSelected = selectedSaves.includes(originalIndex)
                  return (
                    <div 
                      key={originalIndex}
                      className={`save-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleSaveSelection(originalIndex)}
                    >
                      <div className="save-item-header">
                        <div className="save-item-title">
                          <strong>{save.name || save.template?.name || 'Untitled Template'}</strong>
                          <span className="save-item-timestamp">{formatTimestamp(save.timestamp)}</span>
                        </div>
                        <div className="save-item-actions">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!isSelected && selectedSaves.length >= 5}
                            onChange={() => handleToggleSaveSelection(originalIndex)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
                </div>
                )}
              </div>
              <div className="compare-details-container">
                {selectedSaves.length > 0 ? (
                  <div className={`compare-details-grid ${layoutDirection === 'vertical' ? 'vertical-layout' : ''}`}>
                    {selectedSaves.map((saveIndex, idx) => {
                      const save = saves[saveIndex]
                      if (!save) return null
                      return (
                        <div key={saveIndex} className="compare-details-panel">
                          <h4>{save.name || save.template?.name || 'Untitled'}</h4>
                          <div className="save-details-content">
                            {save.emailDetails && (
                              <div className="save-details-section">
                                <h5>Email Details</h5>
                                <JsonView value={save.emailDetails} />
                              </div>
                            )}
                            {save.output && save.output.completions !== undefined && (
                              <div className="save-details-section">
                                <h5>Output Completions</h5>
                                <pre className="completions-text-view">
                                  {(() => {
                                    const formatString = (str) => {
                                      if (typeof str !== 'string') return str
                                      return str
                                        .replace(/\\n/g, '\n')
                                        .replace(/\\t/g, '\t')
                                        .replace(/\\r/g, '\r')
                                        .replace(/\\"/g, '"')
                                        .replace(/\\\\/g, '\\')
                                    }
                                    
                                    const formatValue = (value) => {
                                      if (value === null || value === undefined) {
                                        return 'null'
                                      }
                                      if (typeof value === 'string') {
                                        return formatString(value)
                                      }
                                      if (Array.isArray(value)) {
                                        return value.map(item => formatString(String(item))).join('\n')
                                      }
                                      if (typeof value === 'object') {
                                        return JSON.stringify(value, null, 2)
                                      }
                                      return String(value)
                                    }
                                    
                                    return formatValue(save.output.completions)
                                  })()}
                                </pre>
                              </div>
                            )}
                            {!save.emailDetails && (!save.output || !save.output.completions) && (
                              <p>No data available</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="no-selection-message">
                    <p>Select one or more saved runs to compare side by side.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // Render Compare Prompts for Same Email
  const renderComparePrompts = () => {
    const displaySaves = filteredSavesByConversationId
    
    return (
      <div className="compare-view">
        <div className="compare-filter-section">
          <label htmlFor="conversation-filter">Select Email (Conversation ID):</label>
          <select
            id="conversation-filter"
            value={selectedConversationId}
            onChange={(e) => {
              setSelectedConversationId(e.target.value)
              setSelectedSaves([])
            }}
            className="compare-filter-select"
          >
            <option value="">-- Select an email --</option>
            {conversationIds.map(([conversationId, subject]) => (
              <option key={conversationId} value={conversationId}>
                {subject.length > 20 ? `${subject.substring(0, 20)}...` : subject} ({conversationId.substring(0, 20)}...)
              </option>
            ))}
          </select>
          {selectedConversationId && (
            <button
              className="layout-toggle-button"
              onClick={() => setLayoutDirection(layoutDirection === 'horizontal' ? 'vertical' : 'horizontal')}
              title={`Switch to ${layoutDirection === 'horizontal' ? 'vertical' : 'horizontal'} layout`}
            >
              {layoutDirection === 'horizontal' ? '⇄ Horizontal' : '⇅ Vertical'}
            </button>
          )}
        </div>
        
        {selectedConversationId && (
          <>
            <div className={`analysis-layout ${isLeftPaneCollapsed ? 'left-pane-collapsed' : ''}`}>
              <div className={`saves-list ${isLeftPaneCollapsed ? 'collapsed' : ''}`}>
                {!isLeftPaneCollapsed ? (
                  <>
                    <div 
                      className="saves-list-header"
                      onClick={() => setShowSavesList(!showSavesList)}
                    >
                      <h3>Saved Runs for Selected Email ({displaySaves.length}) {selectedSaves.length > 0 && `(${selectedSaves.length}/5 selected)`}</h3>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="saves-list-toggle">
                          {showSavesList ? '▼' : '▶'}
                        </span>
                        <button
                          className="collapse-pane-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsLeftPaneCollapsed(true)
                          }}
                          title="Collapse pane"
                        >
                          ◀
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="saves-list-header">
                    <button
                      className="expand-pane-button"
                      onClick={() => setIsLeftPaneCollapsed(false)}
                      title="Expand pane"
                    >
                      ▶
                    </button>
                  </div>
                )}
                {showSavesList && (
                <div className="saves-list-items">
                {displaySaves.map((save, idx) => {
                  const originalIndex = saves.indexOf(save)
                  const isSelected = selectedSaves.includes(originalIndex)
                  return (
                    <div 
                      key={originalIndex}
                      className={`save-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleSaveSelection(originalIndex)}
                    >
                      <div className="save-item-header">
                        <div className="save-item-title">
                          <strong>{save.name || save.template?.name || 'Untitled Template'}</strong>
                          <span className="save-item-timestamp">{formatTimestamp(save.timestamp)}</span>
                        </div>
                        <div className="save-item-actions">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!isSelected && selectedSaves.length >= 5}
                            onChange={() => handleToggleSaveSelection(originalIndex)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
                </div>
                )}
              </div>
              <div className="compare-details-container">
                {selectedSaves.length > 0 ? (
                  <div className={`compare-details-grid ${layoutDirection === 'vertical' ? 'vertical-layout' : ''}`}>
                    {selectedSaves.map((saveIndex, idx) => {
                      const save = saves[saveIndex]
                      if (!save) return null
                      return (
                        <div key={saveIndex} className="compare-details-panel">
                          <h4>{save.name || save.template?.name || 'Untitled'}</h4>
                          <div className="save-details-content">
                            {save.emailDetails && (
                              <div className="save-details-section">
                                <h5>Email Details</h5>
                                <JsonView value={save.emailDetails} />
                              </div>
                            )}
                            {save.output && save.output.completions !== undefined && (
                              <div className="save-details-section">
                                <h5>Output Completions</h5>
                                <pre className="completions-text-view">
                                  {(() => {
                                    const formatString = (str) => {
                                      if (typeof str !== 'string') return str
                                      return str
                                        .replace(/\\n/g, '\n')
                                        .replace(/\\t/g, '\t')
                                        .replace(/\\r/g, '\r')
                                        .replace(/\\"/g, '"')
                                        .replace(/\\\\/g, '\\')
                                    }
                                    
                                    const formatValue = (value) => {
                                      if (value === null || value === undefined) {
                                        return 'null'
                                      }
                                      if (typeof value === 'string') {
                                        return formatString(value)
                                      }
                                      if (Array.isArray(value)) {
                                        return value.map(item => formatString(String(item))).join('\n')
                                      }
                                      if (typeof value === 'object') {
                                        return JSON.stringify(value, null, 2)
                                      }
                                      return String(value)
                                    }
                                    
                                    return formatValue(save.output.completions)
                                  })()}
                                </pre>
                              </div>
                            )}
                            {!save.emailDetails && (!save.output || !save.output.completions) && (
                              <p>No data available</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="no-selection-message">
                    <p>Select one or more saved runs to compare side by side.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="analysis-container">
      <div className="analysis-card">
        <div className="analysis-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {viewMode !== 'default' && (
              <button className="back-button" onClick={handleBackToDefault}>
                ← Back
              </button>
            )}
            <h2>Analysis</h2>
          </div>
          {saves.length > 0 && viewMode === 'viewAll' && (
            <button 
              className="clear-all-button"
              onClick={handleClearAll}
            >
              Clear All
            </button>
          )}
        </div>
        <div className="analysis-content">
          {saves.length === 0 ? (
            <p className="no-saves-message">No saved data yet. Save data from the Playground to see it here.</p>
          ) : (
            <>
              {viewMode === 'default' && renderDefaultView()}
              {viewMode === 'viewAll' && renderViewAll()}
              {viewMode === 'compareEmails' && renderCompareEmails()}
              {viewMode === 'comparePrompts' && renderComparePrompts()}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Analysis

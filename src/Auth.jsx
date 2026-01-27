import { useState } from 'react'
import './Auth.css'

function Auth({ bearerToken, ocsToken, onTokenSubmit, onOcsTokenSubmit, onLogout, onOcsTokenClear }) {
  const [showGraphTokenInput, setShowGraphTokenInput] = useState(false)
  const [graphTokenInput, setGraphTokenInput] = useState('')
  const [graphTokenError, setGraphTokenError] = useState('')
  
  const [showOcsTokenInput, setShowOcsTokenInput] = useState(false)
  const [ocsTokenInput, setOcsTokenInput] = useState('')
  const [ocsTokenError, setOcsTokenError] = useState('')

  const handleGraphTokenSubmit = (e) => {
    e.preventDefault()
    
    if (!graphTokenInput.trim()) {
      setGraphTokenError('Please enter a Bearer token')
      return
    }

    // Remove "Bearer " prefix if user included it
    const cleanToken = graphTokenInput.replace(/^Bearer\s+/i, '').trim()
    
    if (!cleanToken) {
      setGraphTokenError('Please enter a valid Bearer token')
      return
    }

    setGraphTokenError('')
    onTokenSubmit(cleanToken)
    setGraphTokenInput('')
    setShowGraphTokenInput(false)
  }

  const handleOcsTokenSubmit = (e) => {
    e.preventDefault()
    
    if (!ocsTokenInput.trim()) {
      setOcsTokenError('Please enter a Bearer token')
      return
    }

    // Remove "Bearer " prefix if user included it
    const cleanToken = ocsTokenInput.replace(/^Bearer\s+/i, '').trim()
    
    if (!cleanToken) {
      setOcsTokenError('Please enter a valid Bearer token')
      return
    }

    setOcsTokenError('')
    onOcsTokenSubmit(cleanToken)
    setOcsTokenInput('')
    setShowOcsTokenInput(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Authentication</h1>
        </div>
        
        <div className="auth-content">
          {/* Microsoft Graph Token Section */}
          <div className="token-section">
            <div className="token-section-header">
              <h2>Microsoft Graph Bearer Token</h2>
              {!bearerToken ? (
                <button 
                  className="add-token-button"
                  onClick={() => setShowGraphTokenInput(true)}
                >
                  Add Bearer Token
                </button>
              ) : (
                <button 
                  className="logout-button"
                  onClick={() => {
                    if (onLogout) {
                      onLogout()
                    }
                  }}
                >
                  Clear Token
                </button>
              )}
            </div>

            {showGraphTokenInput && (
              <div className="token-input-section">
                <h3>Enter Bearer Token</h3>
                <p className="token-note">Note: The token must have the audience set to "https://graph.microsoft.com"</p>
                <p className="token-note">You can generate a token by going to <a href="https://developer.microsoft.com/en-us/graph/graph-explorer" target="_blank" rel="noopener noreferrer">https://developer.microsoft.com/en-us/graph/graph-explorer</a></p>
                <form onSubmit={handleGraphTokenSubmit} className="token-form">
                  <textarea
                    value={graphTokenInput}
                    onChange={(e) => setGraphTokenInput(e.target.value)}
                    placeholder="Paste your Bearer token here..."
                    rows="4"
                    className="token-textarea"
                  />
                  {graphTokenError && (
                    <div className="error-message">
                      {graphTokenError}
                    </div>
                  )}
                  <div className="token-form-buttons">
                    <button type="submit" className="submit-token-button">
                      Submit
                    </button>
                    <button 
                      type="button" 
                      className="cancel-token-button"
                      onClick={() => {
                        setShowGraphTokenInput(false)
                        setGraphTokenInput('')
                        setGraphTokenError('')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {!bearerToken && !showGraphTokenInput && (
              <div className="no-token-message">
                <p>Please add a Bearer token to access Microsoft Graph API features.</p>
              </div>
            )}

            {bearerToken && (
              <div className="token-status">
                <p>✓ Microsoft Graph token is set</p>
              </div>
            )}
          </div>

          {/* OCS Token Section */}
          <div className="token-section">
            <div className="token-section-header">
              <h2>OCS Bearer Token</h2>
              {!ocsToken ? (
                <button 
                  className="add-token-button"
                  onClick={() => setShowOcsTokenInput(true)}
                >
                  Add OCS Bearer Token
                </button>
              ) : (
                <button 
                  className="clear-token-button"
                  onClick={() => {
                    if (onOcsTokenClear) {
                      onOcsTokenClear()
                    }
                  }}
                >
                  Clear Token
                </button>
              )}
            </div>

            {showOcsTokenInput && (
              <div className="token-input-section">
                <h3>Enter OCS Bearer Token</h3>
                <form onSubmit={handleOcsTokenSubmit} className="token-form">
                  <textarea
                    value={ocsTokenInput}
                    onChange={(e) => setOcsTokenInput(e.target.value)}
                    placeholder="Paste your OCS Bearer token here..."
                    rows="4"
                    className="token-textarea"
                  />
                  {ocsTokenError && (
                    <div className="error-message">
                      {ocsTokenError}
                    </div>
                  )}
                  <div className="token-form-buttons">
                    <button type="submit" className="submit-token-button">
                      Submit
                    </button>
                    <button 
                      type="button" 
                      className="cancel-token-button"
                      onClick={() => {
                        setShowOcsTokenInput(false)
                        setOcsTokenInput('')
                        setOcsTokenError('')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {!ocsToken && !showOcsTokenInput && (
              <div className="no-token-message">
                <p>Please add an OCS Bearer token to access the template features.</p>
              </div>
            )}

            {ocsToken && (
              <div className="token-status">
                <p>✓ OCS token is set</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Auth

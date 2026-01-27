import { useState } from 'react'
import './TokenInput.css'

function TokenInput({ onTokenSubmit }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!token.trim()) {
      setError('Please enter a Bearer token')
      return
    }

    // Remove "Bearer " prefix if user included it
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim()
    
    if (!cleanToken) {
      setError('Please enter a valid Bearer token')
      return
    }

    setError('')
    onTokenSubmit(cleanToken)
  }

  return (
    <div className="token-container">
      <div className="token-card">
        <div className="microsoft-logo">
          <svg width="108" height="108" viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="50" height="50" fill="#F25022"/>
            <rect x="58" y="0" width="50" height="50" fill="#7FBA00"/>
            <rect x="0" y="58" width="50" height="50" fill="#00A4EF"/>
            <rect x="58" y="58" width="50" height="50" fill="#FFB900"/>
          </svg>
        </div>
        
        <h1>Enter Bearer Token</h1>
        <p className="token-subtitle">Paste your Microsoft Graph API Bearer token below</p>
        <p className="token-note">Note: The token must have the audience set to "https://graph.microsoft.com"</p>
        
        <form onSubmit={handleSubmit} className="token-form">
          <div className="form-group">
            <label htmlFor="token">Bearer Token</label>
            <textarea
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Bearer token here..."
              rows="6"
              required
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button type="submit" className="submit-button">
            Continue
          </button>
        </form>

        <p className="token-footer">
          The token will be used to authenticate Microsoft Graph API requests
        </p>
      </div>
    </div>
  )
}

export default TokenInput

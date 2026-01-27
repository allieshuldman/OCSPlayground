import { useMsal } from '@azure/msal-react'
import { loginRequest } from './authConfig'
import './Login.css'

function Login() {
  const { instance } = useMsal()

  const handleLogin = async () => {
    try {
      await instance.loginPopup(loginRequest)
      // Login successful - user will be redirected or popup will close
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  const handleLoginRedirect = async () => {
    try {
      await instance.loginRedirect(loginRequest)
    } catch (error) {
      console.error('Login redirect failed:', error)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="microsoft-logo">
          <svg width="108" height="108" viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="50" height="50" fill="#F25022"/>
            <rect x="58" y="0" width="50" height="50" fill="#7FBA00"/>
            <rect x="0" y="58" width="50" height="50" fill="#00A4EF"/>
            <rect x="58" y="58" width="50" height="50" fill="#FFB900"/>
          </svg>
        </div>
        
        <h1>Sign in to your account</h1>
        <p className="login-subtitle">Use your Microsoft account to continue</p>
        
        <button 
          onClick={handleLoginRedirect} 
          className="microsoft-button"
          type="button"
        >
          <svg className="microsoft-icon" width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="10" height="10" fill="#F25022"/>
            <rect x="11" y="0" width="10" height="10" fill="#7FBA00"/>
            <rect x="0" y="11" width="10" height="10" fill="#00A4EF"/>
            <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
          </svg>
          Sign in with Microsoft
        </button>

        <button 
          onClick={handleLogin} 
          className="microsoft-button microsoft-button-secondary"
          type="button"
        >
          <svg className="microsoft-icon" width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="10" height="10" fill="#F25022"/>
            <rect x="11" y="0" width="10" height="10" fill="#7FBA00"/>
            <rect x="0" y="11" width="10" height="10" fill="#00A4EF"/>
            <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
          </svg>
          Sign in with Microsoft (Popup)
        </button>

        <p className="login-footer">
          By signing in, you agree to Microsoft's Terms of Use and Privacy Policy
        </p>
      </div>
    </div>
  )
}

export default Login

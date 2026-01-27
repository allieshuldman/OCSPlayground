import { useState } from 'react'
import Auth from './Auth'
import Graph from './Graph'
import Playground from './Playground'
import Analysis from './Analysis'
import './App.css'

function App() {
  const [bearerToken, setBearerToken] = useState(() => {
    // Load token from localStorage if available
    return localStorage.getItem('bearerToken') || ''
  })
  const [ocsToken, setOcsToken] = useState(() => {
    // Load OCS token from localStorage if available
    return localStorage.getItem('ocsBearerToken') || ''
  })
  const [dashboardProfile, setDashboardProfile] = useState(null)
  const [dashboardFavorites, setDashboardFavorites] = useState([])
  const [currentPage, setCurrentPage] = useState(() => {
    // Load saved page from localStorage or default to 'auth'
    // Handle migration from 'dashboard' to 'graph'
    const saved = localStorage.getItem('currentPage')
    if (saved === 'dashboard') {
      localStorage.setItem('currentPage', 'graph')
      return 'graph'
    }
    return saved || 'auth'
  })
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Load sidebar state from localStorage or default to true
    return localStorage.getItem('sidebarOpen') !== 'false'
  })

  const handleTokenSubmit = (token) => {
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim()
    localStorage.setItem('bearerToken', cleanToken)
    setBearerToken(cleanToken)
  }

  const handleOcsTokenSubmit = (token) => {
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim()
    localStorage.setItem('ocsBearerToken', cleanToken)
    setOcsToken(cleanToken)
  }

  const handleOcsTokenClear = () => {
    localStorage.removeItem('ocsBearerToken')
    setOcsToken('')
  }

  const handleLogout = () => {
    localStorage.removeItem('bearerToken')
    setBearerToken('')
    setDashboardProfile(null)
    setDashboardFavorites([])
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
    localStorage.setItem('currentPage', page)
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
      localStorage.setItem('sidebarOpen', 'false')
    }
  }

  const toggleSidebar = () => {
    const newState = !sidebarOpen
    setSidebarOpen(newState)
    localStorage.setItem('sidebarOpen', newState.toString())
  }

  return (
    <div className="App">
      {/* Hamburger Menu Button */}
      {/* <button 
        className="hamburger-menu-button"
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        <span className={`hamburger-icon ${sidebarOpen ? 'open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button> */}

      {/* Side Panel */}
      <div className={`side-panel ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="side-panel-header">
          <h2>OCS Playground</h2>
        </div>
        <nav className="side-panel-nav">
          <button
            className={`nav-button ${currentPage === 'auth' ? 'active' : ''}`}
            onClick={() => handlePageChange('auth')}
          >
            Auth
          </button>
          <button
            className={`nav-button ${currentPage === 'graph' ? 'active' : ''}`}
            onClick={() => handlePageChange('graph')}
          >
            Graph
          </button>
          <button
            className={`nav-button ${currentPage === 'playground' ? 'active' : ''}`}
            onClick={() => handlePageChange('playground')}
          >
            Playground
          </button>
          <button
            className={`nav-button ${currentPage === 'analysis' ? 'active' : ''}`}
            onClick={() => handlePageChange('analysis')}
          >
            Analysis
          </button>
        </nav>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="side-panel-overlay"
          onClick={toggleSidebar}
        />
      )}

      {/* Main Content */}
      <div className={`main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {currentPage === 'auth' && (
          <Auth 
            bearerToken={bearerToken}
            ocsToken={ocsToken}
            onTokenSubmit={handleTokenSubmit}
            onOcsTokenSubmit={handleOcsTokenSubmit}
            onLogout={handleLogout}
            onOcsTokenClear={handleOcsTokenClear}
          />
        )}
        {currentPage === 'graph' && (
          <Graph 
            bearerToken={bearerToken} 
            onTokenSubmit={handleTokenSubmit} 
            onLogout={handleLogout}
            onProfileChange={setDashboardProfile}
            onFavoritesChange={setDashboardFavorites}
            onTokenError={handleLogout}
          />
        )}
        {currentPage === 'playground' && (
          <Playground 
            bearerToken={bearerToken}
            ocsToken={ocsToken}
            dashboardProfile={dashboardProfile} 
            dashboardFavorites={dashboardFavorites}
            onOcsTokenError={handleOcsTokenClear}
          />
        )}
        {currentPage === 'analysis' && (
          <Analysis />
        )}
      </div>
    </div>
  )
}

export default App

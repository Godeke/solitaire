import React from 'react'
import { CardDemo } from '../components'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Solitaire Game Collection</h1>
        <p>Welcome to your desktop solitaire games!</p>
      </header>
      <main className="app-main">
        <CardDemo />
      </main>
    </div>
  )
}

export default App
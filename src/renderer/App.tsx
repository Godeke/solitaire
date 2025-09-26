import React from 'react'
import { GameManager, DragDropProvider } from '../components'
import './App.css'

function App() {
  return (
    <div className="app">
      <main className="app-main">
        <DragDropProvider>
          <GameManager />
        </DragDropProvider>
      </main>
    </div>
  )
}

export default App
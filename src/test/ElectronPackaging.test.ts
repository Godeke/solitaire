import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Electron Packaging Configuration', () => {
    let packageJson: any

    beforeAll(() => {
        const packagePath = join(process.cwd(), 'package.json')
        const packageContent = readFileSync(packagePath, 'utf-8')
        packageJson = JSON.parse(packageContent)
    })

    describe('Build Configuration', () => {
        it('should have correct app metadata', () => {
            expect(packageJson.build.appId).toBe('com.solitaire.game-collection')
            expect(packageJson.build.productName).toBe('Solitaire Game Collection')
        })

        it('should include required files', () => {
            const files = packageJson.build.files
            expect(files).toContain('dist/**/*')
            expect(files).toContain('assets/**/*')
        })

        it('should have platform-specific configurations', () => {
            expect(packageJson.build.mac).toBeDefined()
            expect(packageJson.build.win).toBeDefined()
            expect(packageJson.build.linux).toBeDefined()
        })

        it('should have correct macOS configuration', () => {
            const macConfig = packageJson.build.mac
            expect(macConfig.category).toBe('public.app-category.games')
            expect(macConfig.icon).toBe('assets/icon.icns')
            expect(macConfig.target).toBeDefined()
            expect(Array.isArray(macConfig.target)).toBe(true)
        })

        it('should have correct Windows configuration', () => {
            const winConfig = packageJson.build.win
            expect(winConfig.icon).toBe('assets/icon.ico')
            expect(winConfig.publisherName).toBe('Solitaire Game Collection')
            expect(winConfig.target).toBeDefined()
            expect(Array.isArray(winConfig.target)).toBe(true)
        })

        it('should have correct Linux configuration', () => {
            const linuxConfig = packageJson.build.linux
            expect(linuxConfig.icon).toBe('assets/icon.png')
            expect(linuxConfig.category).toBe('Game')
            expect(linuxConfig.target).toBeDefined()
            expect(Array.isArray(linuxConfig.target)).toBe(true)
        })

        it('should have NSIS installer configuration', () => {
            const nsisConfig = packageJson.build.nsis
            expect(nsisConfig.oneClick).toBe(false)
            expect(nsisConfig.allowToChangeInstallationDirectory).toBe(true)
            expect(nsisConfig.createDesktopShortcut).toBe(true)
            expect(nsisConfig.createStartMenuShortcut).toBe(true)
            expect(nsisConfig.shortcutName).toBe('Solitaire Game Collection')
        })

        it('should have DMG configuration', () => {
            const dmgConfig = packageJson.build.dmg
            expect(dmgConfig.title).toBe('Solitaire Game Collection')
            expect(dmgConfig.icon).toBe('assets/icon.icns')
            expect(dmgConfig.window).toBeDefined()
            expect(dmgConfig.contents).toBeDefined()
            expect(Array.isArray(dmgConfig.contents)).toBe(true)
        })
    })

    describe('Build Scripts', () => {
        it('should have all required build scripts', () => {
            const scripts = packageJson.scripts
            expect(scripts.build).toBeDefined()
            expect(scripts['build:renderer']).toBeDefined()
            expect(scripts['build:main']).toBeDefined()
            expect(scripts.package).toBeDefined()
        })

        it('should have platform-specific package scripts', () => {
            const scripts = packageJson.scripts
            expect(scripts['package:win']).toBeDefined()
            expect(scripts['package:mac']).toBeDefined()
            expect(scripts['package:linux']).toBeDefined()
        })

        it('should have distribution scripts', () => {
            const scripts = packageJson.scripts
            expect(scripts.dist).toBeDefined()
            expect(scripts['dist:win']).toBeDefined()
            expect(scripts['dist:mac']).toBeDefined()
            expect(scripts['dist:linux']).toBeDefined()
        })
    })

    describe('Dependencies', () => {
        it('should have electron as dev dependency', () => {
            expect(packageJson.devDependencies.electron).toBeDefined()
        })

        it('should have electron-builder as dev dependency', () => {
            expect(packageJson.devDependencies['electron-builder']).toBeDefined()
        })

        it('should have required build tools', () => {
            expect(packageJson.devDependencies.typescript).toBeDefined()
            expect(packageJson.devDependencies.vite).toBeDefined()
            expect(packageJson.devDependencies.concurrently).toBeDefined()
        })
    })

    describe('Main Process Configuration', () => {
        it('should point to correct main file', () => {
            expect(packageJson.main).toBe('dist/main/main.js')
        })

        it('should have correct homepage for relative paths', () => {
            expect(packageJson.homepage).toBe('./')
        })
    })

    describe('Development Configuration', () => {
        it('should have development scripts', () => {
            const scripts = packageJson.scripts
            expect(scripts.dev).toBeDefined()
            expect(scripts['dev:renderer']).toBeDefined()
            expect(scripts['dev:electron']).toBeDefined()
        })

        it('should have wait-on dependency for development', () => {
            expect(packageJson.devDependencies['wait-on']).toBeDefined()
        })
    })
})
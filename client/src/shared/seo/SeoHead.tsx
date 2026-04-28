import { useEffect } from 'react'
import type { Page } from '../hooks'

type SeoConfig = {
  title: string
  description: string
  canonicalPath: string
  ogTitle?: string
  ogDescription?: string
  ogType?: string
  robots?: 'index,follow' | 'noindex,nofollow'
  jsonLd?: Record<string, unknown>
}

function ensureMetaTag(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function ensureCanonical(href: string) {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
}

function ensureJsonLd(payload: Record<string, unknown> | undefined) {
  const scriptId = 'seo-jsonld'
  const existing = document.getElementById(scriptId)
  if (!payload) {
    existing?.remove()
    return
  }

  const script = existing ?? document.createElement('script')
  script.id = scriptId
  script.setAttribute('type', 'application/ld+json')
  script.textContent = JSON.stringify(payload)
  if (!existing) {
    document.head.appendChild(script)
  }
}

export function SeoHead({ config }: { config: SeoConfig }) {
  useEffect(() => {
    document.title = config.title
    ensureMetaTag('name', 'description', config.description)
    ensureMetaTag('name', 'robots', config.robots ?? 'index,follow')
    ensureMetaTag('property', 'og:title', config.ogTitle ?? config.title)
    ensureMetaTag('property', 'og:description', config.ogDescription ?? config.description)
    ensureMetaTag('property', 'og:type', config.ogType ?? 'website')
    ensureMetaTag('property', 'og:url', `${window.location.origin}${config.canonicalPath}`)
    ensureCanonical(`${window.location.origin}${config.canonicalPath}`)
    ensureJsonLd(config.jsonLd)
  }, [config])

  return null
}

export function buildSeoConfig(page: Page, isAuthenticated: boolean): SeoConfig {
  const base = {
    ogType: 'website' as const
  }

  switch (page) {
    case 'home':
      return {
        ...base,
        title: 'MTUCI Guesser - Геоигра по корпусу МТУСИ',
        description: 'Угадывайте локации кампуса МТУСИ по фотографиям и соревнуйтесь в рейтинге.',
        canonicalPath: '/'
      }
    case 'leaderboard':
      return {
        ...base,
        title: 'Рейтинг игроков - MTUCI Guesser',
        description: 'Открытая таблица результатов MTUCI Guesser с лучшими игроками.',
        canonicalPath: '/leaderboard',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Рейтинг MTUCI Guesser',
          description: 'Публичный рейтинг лучших результатов игры MTUCI Guesser.'
        }
      }
    case 'login':
      return {
        ...base,
        title: 'Вход - MTUCI Guesser',
        description: 'Авторизация для сохранения результатов в MTUCI Guesser.',
        canonicalPath: '/login',
        robots: 'noindex,nofollow'
      }
    case 'register':
      return {
        ...base,
        title: 'Регистрация - MTUCI Guesser',
        description: 'Создайте аккаунт для участия в рейтинге MTUCI Guesser.',
        canonicalPath: '/register',
        robots: 'noindex,nofollow'
      }
    case 'play':
      return {
        ...base,
        title: 'Игра - MTUCI Guesser',
        description: 'Игровой режим определения локаций в MTUCI Guesser.',
        canonicalPath: '/play',
        robots: 'noindex,nofollow'
      }
    case 'play360':
      return {
        ...base,
        title: 'Игра 360 - MTUCI Guesser',
        description: 'Экспериментальный 360-режим MTUCI Guesser.',
        canonicalPath: '/play360',
        robots: 'noindex,nofollow'
      }
    case 'duel':
      return {
        ...base,
        title: 'Дуэли - MTUCI Guesser',
        description: 'Соревновательные дуэли один на один в MTUCI Guesser.',
        canonicalPath: '/duel',
        robots: isAuthenticated ? 'index,follow' : 'noindex,nofollow'
      }
    case 'account':
      return {
        ...base,
        title: 'Личный кабинет - MTUCI Guesser',
        description: 'Управление профилем игрока MTUCI Guesser.',
        canonicalPath: '/account',
        robots: 'noindex,nofollow'
      }
    case 'admin':
      return {
        ...base,
        title: 'Админ панель - MTUCI Guesser',
        description: 'Административный раздел MTUCI Guesser.',
        canonicalPath: '/admin',
        robots: 'noindex,nofollow'
      }
    default:
      return {
        ...base,
        title: 'MTUCI Guesser',
        description: 'Игра по угадыванию локаций в кампусе МТУСИ.',
        canonicalPath: '/'
      }
  }
}

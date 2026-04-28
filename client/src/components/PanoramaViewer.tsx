import React, { useEffect, useRef } from 'react'
import './PanoramaViewer.css'
import 'pannellum/build/pannellum.css'
import 'pannellum'

interface PanoramaViewerProps {
  imageUrl: string
}

export default function PanoramaViewer({ imageUrl }: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    if (viewerRef.current && typeof viewerRef.current.destroy === 'function') {
      viewerRef.current.destroy()
      viewerRef.current = null
    }

    if (!window.pannellum) return

    viewerRef.current = window.pannellum.viewer(containerRef.current, {
      type: 'equirectangular',
      panorama: imageUrl,
      autoLoad: true,
      showControls: true,
      compass: false,
      mouseZoom: true,
      draggable: true,
      friction: 0.15,
      hfov: 100,
      minHfov: 50,
      maxHfov: 120,
      pitch: 0,
      yaw: 0
    })

    return () => {
      if (viewerRef.current && typeof viewerRef.current.destroy === 'function') {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [imageUrl])

  return (
    <div className="panorama-viewer-shell">
      <div ref={containerRef} className="panorama-viewer" />
      <div className="panorama-overlay">Потяните, чтобы осмотреть 360°</div>
    </div>
  )
}


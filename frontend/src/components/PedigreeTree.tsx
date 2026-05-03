import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import Tree from 'react-d3-tree'
import type { RawNodeDatum, CustomNodeElementProps } from 'react-d3-tree'

interface Props {
  horse: { id: string; name: string; breed: string }
  pedigree: Record<string, { name?: string; breed?: string }>
  inbreedingFlags: Array<{ name: string; count: number; severity: string }>
}

function buildSubtree(
  prefix: string,
  pedigree: Record<string, { name?: string; breed?: string }>,
  inbreeding: Map<string, string>,
  depth: number,
): RawNodeDatum {
  const data = pedigree[prefix]
  const name = data?.name ?? '—'
  const severity = data?.name ? (inbreeding.get(data.name.toLowerCase()) ?? '') : ''

  const node: RawNodeDatum = {
    name,
    attributes: {
      breed: data?.breed ?? '',
      severity,
    },
  }

  if (depth > 1) {
    const sireKey = `${prefix}_sire`
    const damKey = `${prefix}_dam`
    if (pedigree[sireKey] || pedigree[damKey]) {
      const children: RawNodeDatum[] = []
      if (pedigree[sireKey]) children.push(buildSubtree(sireKey, pedigree, inbreeding, depth - 1))
      if (pedigree[damKey]) children.push(buildSubtree(damKey, pedigree, inbreeding, depth - 1))
      node.children = children
    }
  }

  return node
}

function NodeCard({ nodeDatum }: CustomNodeElementProps) {
  const severity = nodeDatum.attributes?.severity as string | undefined
  const breed = nodeDatum.attributes?.breed as string | undefined

  const borderColor =
    severity === 'high' ? '#dc2626' : severity === 'medium' ? '#d97706' : '#e7e5e4'

  return (
    <foreignObject x={-80} y={-32} width={160} height={64}>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fff',
          border: `2px solid ${borderColor}`,
          borderRadius: 8,
          padding: '6px 10px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <p style={{ margin: 0, fontWeight: 700, fontSize: 12, lineHeight: 1.3, color: '#1c1917' }}>
          {nodeDatum.name}
        </p>
        {breed && (
          <p style={{ margin: 0, fontSize: 11, color: '#a8a29e', lineHeight: 1.3 }}>{breed}</p>
        )}
      </div>
    </foreignObject>
  )
}

export default function PedigreeTree({ horse, pedigree, inbreedingFlags }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [translate, setTranslate] = useState({ x: 120, y: 250 })

  const inbreedingMap = useMemo(
    () => new Map(inbreedingFlags.map((f) => [f.name.toLowerCase(), f.severity])),
    [inbreedingFlags],
  )

  const treeData = useMemo<RawNodeDatum>(() => {
    const rootSeverity = inbreedingMap.get(horse.name.toLowerCase()) ?? ''
    const node: RawNodeDatum = {
      name: horse.name,
      attributes: { breed: horse.breed, severity: rootSeverity },
    }
    const children: RawNodeDatum[] = []
    if (pedigree['sire']) children.push(buildSubtree('sire', pedigree, inbreedingMap, 3))
    if (pedigree['dam']) children.push(buildSubtree('dam', pedigree, inbreedingMap, 3))
    if (children.length) node.children = children
    return node
  }, [horse, pedigree, inbreedingMap])

  const updateTranslate = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect()
      setTranslate({ x: width * 0.15, y: height / 2 })
    }
  }, [])

  useEffect(() => {
    updateTranslate()
    window.addEventListener('resize', updateTranslate)
    return () => window.removeEventListener('resize', updateTranslate)
  }, [updateTranslate])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Tree
        data={treeData}
        orientation="horizontal"
        pathFunc="step"
        translate={translate}
        nodeSize={{ x: 220, y: 80 }}
        separation={{ siblings: 1.5, nonSiblings: 2 }}
        zoom={0.7}
        renderCustomNodeElement={(props) => <NodeCard {...props} />}
        collapsible={false}
      />
    </div>
  )
}

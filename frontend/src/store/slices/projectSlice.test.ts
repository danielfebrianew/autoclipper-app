import { describe, it, expect } from 'vitest'
import reducer, {
  setDownloadProgress, clearDownloadProgress, setCurrent,
  fetchProjects, fetchProject, deleteProject, Project,
} from './projectSlice'

const init = () => reducer(undefined, { type: '@@INIT' })
const project = (over: Partial<Project>): Project => ({ id: 'p1', name: 'P', status: 'ready', source_video_id: 'v1', gemini_json: '', created_at: '', updated_at: '', ...over })

describe('projectSlice', () => {
  it('setDownloadProgress / clearDownloadProgress manage per-project progress', () => {
    let s = reducer(init(), setDownloadProgress({ projectId: 'p1', step: 'dl', percent: 50, message: '' }))
    expect(s.downloadProgress.p1.percent).toBe(50)
    s = reducer(s, clearDownloadProgress('p1'))
    expect(s.downloadProgress.p1).toBeUndefined()
  })

  it('setCurrent sets the current project', () => {
    const p = project({ id: 'p9' })
    expect(reducer(init(), setCurrent(p)).current).toEqual(p)
  })

  it('fetchProjects.pending sets loading', () => {
    expect(reducer(init(), { type: fetchProjects.pending.type }).loading).toBe(true)
  })

  it('fetchProjects.fulfilled stores list and clears loading', () => {
    const list = [project({ id: 'a' })]
    const s = reducer({ ...init(), loading: true }, { type: fetchProjects.fulfilled.type, payload: list })
    expect(s.list).toEqual(list)
    expect(s.loading).toBe(false)
  })

  it('fetchProjects.rejected records the error', () => {
    const s = reducer({ ...init(), loading: true }, { type: fetchProjects.rejected.type, error: { message: 'oops' } })
    expect(s.error).toBe('oops')
    expect(s.loading).toBe(false)
  })

  it('fetchProject.fulfilled sets current', () => {
    const p = project({ id: 'p2' })
    expect(reducer(init(), { type: fetchProject.fulfilled.type, payload: p }).current).toEqual(p)
  })

  it('deleteProject.fulfilled removes the project by meta.arg', () => {
    const seeded = { ...init(), list: [project({ id: 'a' }), project({ id: 'b' })] }
    const s = reducer(seeded, { type: deleteProject.fulfilled.type, meta: { arg: 'a' } })
    expect(s.list.map(p => p.id)).toEqual(['b'])
  })
})

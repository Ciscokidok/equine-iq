import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createMare, updateMare, getMare } from '@/api/mares'

const DISCIPLINES = ['sport_horse','warmblood','quarter_horse','paint','reining','cutting','barrel_racing','hunter_jumper','dressage','eventing','other']

type FormData = {
  name: string
  breed: string
  discipline: string
  color?: string
  heightHands?: number
  dateOfBirth?: string
  conformationNotes?: string
  pedigreeSire?: string
  pedigreeDam?: string
  pedigreeSireSire?: string
  pedigreeSireDam?: string
  pedigreeDamSire?: string
  pedigreeDamDam?: string
}

export default function MareForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = !!id

  const { data: existing } = useQuery({
    queryKey: ['mare', id],
    queryFn: () => getMare(id!),
    enabled: isEdit,
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    values: existing ? {
      name: existing.name,
      breed: existing.breed,
      discipline: existing.discipline,
      color: existing.color ?? '',
      heightHands: existing.heightHands,
      dateOfBirth: existing.dateOfBirth?.split('T')[0] ?? '',
      conformationNotes: existing.conformationNotes ?? '',
      pedigreeSire: (existing.pedigree?.sire?.name as string) ?? '',
      pedigreeDam: (existing.pedigree?.dam?.name as string) ?? '',
      pedigreeSireSire: (existing.pedigree?.sire_sire?.name as string) ?? '',
      pedigreeSireDam: (existing.pedigree?.sire_dam?.name as string) ?? '',
      pedigreeDamSire: (existing.pedigree?.dam_sire?.name as string) ?? '',
      pedigreeDamDam: (existing.pedigree?.dam_dam?.name as string) ?? '',
    } : undefined,
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        name: data.name,
        breed: data.breed,
        discipline: data.discipline,
        color: data.color,
        heightHands: data.heightHands ? Number(data.heightHands) : undefined,
        dateOfBirth: data.dateOfBirth || undefined,
        conformationNotes: data.conformationNotes,
        pedigree: {
          ...(data.pedigreeSire ? { sire: { name: data.pedigreeSire } } : {}),
          ...(data.pedigreeDam ? { dam: { name: data.pedigreeDam } } : {}),
          ...(data.pedigreeSireSire ? { sire_sire: { name: data.pedigreeSireSire } } : {}),
          ...(data.pedigreeSireDam ? { sire_dam: { name: data.pedigreeSireDam } } : {}),
          ...(data.pedigreeDamSire ? { dam_sire: { name: data.pedigreeDamSire } } : {}),
          ...(data.pedigreeDamDam ? { dam_dam: { name: data.pedigreeDamDam } } : {}),
        },
      }
      return isEdit ? updateMare(id!, payload) : createMare(payload)
    },
    onSuccess: (mare) => {
      qc.invalidateQueries({ queryKey: ['mares'] })
      toast.success(isEdit ? 'Mare updated' : 'Mare added')
      navigate(`/mares/${mare.id}`)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Something went wrong'
      toast.error(typeof msg === 'string' ? msg : 'Validation error')
    },
  })

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold mb-6">{isEdit ? 'Edit Mare' : 'Add Mare'}</h1>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input {...register('name', { required: true })} className="input w-full" />
            {errors.name && <p className="text-xs text-red-500 mt-1">Required</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Breed *</label>
            <input {...register('breed', { required: true })} className="input w-full" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Discipline *</label>
            <select {...register('discipline', { required: true })} className="input w-full">
              {DISCIPLINES.map(d => (
                <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <input {...register('color')} className="input w-full" placeholder="e.g. Bay, Chestnut" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Date of Birth</label>
            <input type="date" {...register('dateOfBirth')} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Height (hands)</label>
            <input type="number" step="0.1" {...register('heightHands')} className="input w-full" placeholder="16.2" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Conformation Notes</label>
          <textarea
            {...register('conformationNotes')}
            className="input w-full h-20 resize-none"
            placeholder="e.g. Slight offset in left front, excellent topline, slightly downhill build"
          />
        </div>

        {/* Pedigree — 2 generations */}
        <div>
          <p className="text-sm font-semibold mb-3 text-stone-700">Pedigree</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: 'pedigreeSire', label: 'Sire (father)' },
              { key: 'pedigreeDam', label: 'Dam (mother)' },
              { key: 'pedigreeSireSire', label: "Sire's Sire" },
              { key: 'pedigreeSireDam', label: "Sire's Dam" },
              { key: 'pedigreeDamSire', label: "Dam's Sire" },
              { key: 'pedigreeDamDam', label: "Dam's Dam" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-stone-500 mb-0.5">{label}</label>
                <input {...register(key as keyof FormData)} className="input w-full text-sm" placeholder="Horse name" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-brand-700 text-white px-4 py-2 rounded text-sm hover:bg-brand-900 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Mare'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded text-sm border border-stone-200 hover:bg-stone-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

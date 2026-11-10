import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import Button from '~/ui/Button'
import Input from '~/ui/Input'

import { readJourney } from './api'
import type { JourneyLabels } from './model'
import type { JourneyUser, JourneyUsers } from './types'

export default function UserScope({
  root,
  query,
  profile,
  labels: l,
  onSelect,
}: {
  root: string
  query: string
  profile: string
  labels: JourneyLabels
  onSelect: (user?: JourneyUser) => void
}) {
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const canSearch = (value: string) =>
    value.trim().length >= 2 || /^[1-9]$/.test(value.trim())
  const params = new URLSearchParams(query)
  params.delete('profile')
  params.set('query', search)
  const path = `${root}/users?${params}`
  const result = useQuery({
    queryKey: ['novix-journey-users', path],
    queryFn: ({ signal }) => readJourney<JourneyUsers>(path, signal),
    enabled: canSearch(search),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
  return (
    <div className='mb-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950'>
      <div className='flex flex-wrap items-end gap-3'>
        <Button
          variant={profile ? 'secondary' : 'primary'}
          aria-pressed={!profile}
          onClick={() => {
            onSelect()
            setSearch('')
          }}
        >
          {l.allUsers}
        </Button>
        {profile ? (
          <span className='mb-2 text-sm font-medium'>
            {l.user}: {profile.replace(/^usr_/, '')}
          </span>
        ) : null}
        <form
          className='flex min-w-0 flex-1 flex-wrap items-end gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            const next = draft.trim()
            if (next === search) void result.refetch()
            else setSearch(next)
          }}
        >
          <Input
            label={l.user}
            aria-label={l.searchHint}
            className='min-w-48 flex-1'
            placeholder={l.searchHint}
            value={draft}
            maxLength={128}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type='submit'
            variant='secondary'
            disabled={!canSearch(draft)}
            loading={result.isFetching}
          >
            {l.search}
          </Button>
        </form>
      </div>
      {result.error ? (
        <p
          role='alert'
          className='mt-3 text-sm text-amber-700 dark:text-amber-300'
        >
          {l.searchError}
        </p>
      ) : null}
      {result.data && search ? (
        <div className='mt-3 flex flex-wrap gap-2'>
          {result.data.users.length ? (
            result.data.users.map((user) => (
              <Button
                key={user.profileId}
                size='sm'
                variant='secondary'
                onClick={() => {
                  onSelect(user)
                  setSearch('')
                }}
              >
                {user.email || `Novix #${user.userId}`} · #{user.userId}
              </Button>
            ))
          ) : (
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              {l.searchEmpty}
            </p>
          )}
          {result.data.hasMore ? (
            <p className='w-full text-sm text-gray-500 dark:text-gray-400'>
              {l.searchMore}
            </p>
          ) : null}
        </div>
      ) : null}
      {profile ? (
        <p className='mt-3 text-xs text-gray-500 dark:text-gray-400'>
          {l.identityHint}
        </p>
      ) : null}
    </div>
  )
}

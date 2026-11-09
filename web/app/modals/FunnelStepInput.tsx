import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { getDimensionValues } from '~/api/v2/endpoints'
import { useCurrentProject } from '~/providers/CurrentProjectProvider'
import { useTheme } from '~/providers/ThemeProvider'
import FilterValueInput from '~/ui/FilterValueInput'
import { Text } from '~/ui/Text'

export type FunnelStepType = 'page' | 'event'

interface FunnelStepInputProps {
  type: FunnelStepType
  value: string
  onChange: (value: string) => void
  active: boolean
  disabled: boolean
}

export default function FunnelStepInput({
  type,
  value,
  onChange,
  active,
  disabled,
}: FunnelStepInputProps) {
  const { id } = useCurrentProject()
  const { theme } = useTheme()
  const { t, i18n } = useTranslation('common')
  const suggestions = useQuery({
    queryKey: ['v2', id, 'funnel-step-values', type],
    queryFn: ({ signal }) =>
      getDimensionValues(id, type, { type: 'traffic' }, signal),
    enabled: active && !disabled,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
  const items = useMemo(
    () =>
      [
        ...new Set(
          (suggestions.data?.data || []).filter(
            (item): item is string =>
              typeof item === 'string' &&
              Boolean(item.trim()) &&
              (type === 'page' ? item.startsWith('/') : !item.startsWith('/')),
          ),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [suggestions.data, type],
  )

  return (
    <div className='!ml-0 min-w-0 flex-1'>
      <FilterValueInput
        items={items}
        value={value}
        onChange={onChange}
        placeholder={t(
          type === 'page'
            ? 'modals.funnels.searchPages'
            : 'modals.funnels.searchEvents',
        )}
        column={type}
        language={i18n.language}
        theme={theme}
        disabled={disabled}
        isLoading={suggestions.isFetching && !suggestions.data}
        commitOnType
      />
      {suggestions.isError ? (
        <Text
          as='p'
          size='xs'
          colour='secondary'
          aria-live='polite'
          className='mt-1'
        >
          {t('modals.funnels.suggestionsError')}{' '}
          <button
            type='button'
            disabled={suggestions.isFetching}
            onClick={() => void suggestions.refetch()}
            className='underline decoration-dashed hover:decoration-solid'
          >
            {t('modals.funnels.retry')}
          </button>
        </Text>
      ) : null}
    </div>
  )
}

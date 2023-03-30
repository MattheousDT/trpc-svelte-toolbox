/**
 * @see official implementation here: {@link https://github.com/TanStack/query/blob/alpha/packages/svelte-query/src/createBaseQuery.ts}
 */

import { derived, get, readable, writable } from 'svelte/store'
import type { Writable } from 'svelte/store'
import {
  notifyManager,
  type QueryObserver,
  type QueryClient,
  type QueryKey,
  type CreateQueryResult,
  type QueryObserverOptions,
} from '@tanstack/svelte-query'

export type MaybeWritable<T> = T | Writable<T>

export const isWritable = <T>(obj: MaybeWritable<T>): obj is Writable<T> =>
  obj != null && typeof obj === 'object' && 'subscribe' in obj && 'set' in obj && 'update' in obj

export function createReactiveQuery<TQueryFnData, TError, TData, TQueryData, TQueryKey extends QueryKey>(
  options: MaybeWritable<QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>>,
  Observer: typeof QueryObserver,
  queryClient: QueryClient
): CreateQueryResult<TData, TError> {
  const optionsStore = isWritable(options) ? options : writable(options)

  const defaultOptionsStore = derived(optionsStore, ($options) => {
    const defaultOptions = queryClient.defaultQueryOptions($options)
    // eslint-disable-next-line no-underscore-dangle, no-param-reassign
    defaultOptions._optimisticResults = 'optimistic'

    if (defaultOptions.onError != null) {
      defaultOptions.onError = notifyManager.batchCalls(defaultOptions.onError)
    }

    if (defaultOptions.onSuccess != null) {
      defaultOptions.onSuccess = notifyManager.batchCalls(defaultOptions.onSuccess)
    }

    if (defaultOptions.onSettled != null) {
      defaultOptions.onSettled = notifyManager.batchCalls(defaultOptions.onSettled)
    }

    return defaultOptions
  })

  const observer = new Observer<TQueryFnData, TError, TData, TQueryData, TQueryKey>(
    queryClient,
    get(defaultOptionsStore)
  )

  defaultOptionsStore.subscribe(($defaultedOptions) => {
    // Do not notify on updates because of changes in the options because
    // these changes should already be reflected in the optimistic result.
    observer.setOptions($defaultedOptions, { listeners: false })
  })

  const result = readable(observer.getCurrentResult(), (set) => observer.subscribe(notifyManager.batchCalls(set)))

  const { subscribe } = derived(result, ($result) => {
    // eslint-disable-next-line no-param-reassign
    $result = observer.getOptimisticResult(get(defaultOptionsStore))
    return get(defaultOptionsStore).notifyOnChangeProps == null ? observer.trackResult($result) : $result
  })

  return { subscribe }
}

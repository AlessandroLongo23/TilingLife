import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { browser } from '$app/environment';

export const supabase = browser ? createBrowserClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
    {
        cookies: {
            get(key) {
                const cookie = document.cookie
                    .split('; ')
                    .find((row) => row.startsWith(`${key}=`))
                return cookie ? decodeURIComponent(cookie.split('=')[1]) : null
            },
            set(key, value, options) {
                const cookie = [`${key}=${encodeURIComponent(value)}`, `path=/`]
                if (options?.maxAge) {
                    cookie.push(`max-age=${options.maxAge}`)
                }
                if (options?.domain) {
                    cookie.push(`domain=${options.domain}`)
                }
                document.cookie = cookie.join('; ')
            },
            remove(key) {
                document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
            }
        }
    }
) : null

export const createClient = (cookies) => {
    if (browser) {
        return supabase
    }

    return createServerClient(
        PUBLIC_SUPABASE_URL,
        PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                get: (key) => cookies.get(key),
                set: (key, value, options) => {
                    cookies.set(key, value, {
                        ...options,
                        path: '/',
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        maxAge: 60 * 60 * 24 * 7 // 1 week
                    })
                },
                remove: (key) => cookies.delete(key, { path: '/' })
            }
        }
    )
}

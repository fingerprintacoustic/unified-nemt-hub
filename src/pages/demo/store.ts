import { createContext, useCallback, useContext, useMemo, useReducer, useRef, useState } from 'react'
import type { TripStatus, UserRole } from '../../types'
import { PERSONAS, PLACES, HOUR, initialData, type DBillingLine, type DemoData } from './data'

interface State {
  data: DemoData
  role: UserRole
  done: Record<string, true>
}

type Action =
  | { type: 'setRole'; role: UserRole }
  | { type: 'mark'; key: string }
  | { type: 'reset' }
  | { type: 'assignTrip'; tripId: string; driverId: string; vehicleId: string }
  | { type: 'setTripStatus'; tripId: string; status: TripStatus }
  | { type: 'addTrip'; from: string; to: string; hours: number; mobility: string }
  | { type: 'setVehicleStatus'; id: string; status: DemoData['vehicles'][number]['status'] }
  | { type: 'updateLocation'; id: string; where: string; speedMph: number; ignitionOn: boolean }
  | { type: 'reviewInspection'; id: string; status: 'APPROVED' | 'FLAGGED' }
  | { type: 'submitInspection'; vehicleId: string; kind: 'PRE_TRIP' | 'POST_TRIP'; brakesPoor: boolean; note: string }
  | { type: 'finalizeBilling' }
  | { type: 'reopenBilling' }
  | { type: 'exportBilling' }
  | { type: 'setPayrollAmount'; driverId: string; value: string }
  | { type: 'approvePayroll' }
  | { type: 'reopenPayroll' }
  | { type: 'exportPayroll' }
  | { type: 'setUserRole'; id: string; role: UserRole }
  | { type: 'toggleUser'; id: string }
  | { type: 'deleteVehicle'; id: string }

let counter = 100

function withAudit(state: State, action: string, target: string, details?: string): DemoData['audit'] {
  const persona = PERSONAS[state.role]
  return [
    { id: `a${counter++}`, at: Date.now(), actor: persona.name, role: state.role, action, target, details },
    ...state.data.audit,
  ]
}

export function billableTrips(data: DemoData): DBillingLine[] {
  return data.trips
    .filter((t) => t.status === 'COMPLETED')
    .map((t) => ({ tripId: t.id, route: `${t.from} → ${t.to}`, fare: t.fare }))
}

function reducer(state: State, action: Action): State {
  const mark = (key: string): Record<string, true> => ({ ...state.done, [key]: true })
  const d = state.data

  switch (action.type) {
    case 'setRole':
      return { ...state, role: action.role }
    case 'mark':
      return { ...state, done: mark(action.key) }
    case 'reset':
      return { data: initialData(), role: state.role, done: {} }

    case 'assignTrip':
      return {
        ...state,
        done: mark('assignedTrip'),
        data: {
          ...d,
          trips: d.trips.map((t) =>
            t.id === action.tripId
              ? { ...t, driverId: action.driverId, vehicleId: action.vehicleId, status: t.status === 'SCHEDULED' ? 'ASSIGNED' : t.status }
              : t,
          ),
        },
      }
    case 'setTripStatus': {
      let done = state.done
      if (action.status === 'EN_ROUTE') done = { ...done, startedTrip: true }
      if (action.status === 'COMPLETED') done = { ...done, completedTrip: true }
      return { ...state, done, data: { ...d, trips: d.trips.map((t) => (t.id === action.tripId ? { ...t, status: action.status } : t)) } }
    }
    case 'addTrip': {
      const id = `t${counter++}`
      return {
        ...state,
        done: mark('scheduledTrip'),
        data: {
          ...d,
          trips: [
            ...d.trips,
            { id, pickupAt: Date.now() + action.hours * HOUR, from: PLACES[action.from], to: PLACES[action.to], status: 'SCHEDULED', fare: 40, broker: 'MedRide', mobility: action.mobility },
          ],
        },
      }
    }

    case 'setVehicleStatus':
      return { ...state, done: mark('updatedVehicle'), data: { ...d, vehicles: d.vehicles.map((v) => (v.id === action.id ? { ...v, status: action.status } : v)) } }
    case 'updateLocation':
      return {
        ...state,
        done: mark('updatedVehicle'),
        data: {
          ...d,
          vehicles: d.vehicles.map((v) =>
            v.id === action.id ? { ...v, where: action.where, speedMph: action.speedMph, ignitionOn: action.ignitionOn, recordedAt: Date.now() } : v,
          ),
        },
      }
    case 'deleteVehicle':
      return {
        ...state,
        done: mark('deletedVehicle'),
        data: { ...d, vehicles: d.vehicles.filter((v) => v.id !== action.id), audit: withAudit(state, 'vehicle.deleted', `vehicles / ${action.id}`) },
      }

    case 'reviewInspection':
      return {
        ...state,
        done: mark('reviewedInspection'),
        data: {
          ...d,
          inspections: d.inspections.map((i) => (i.id === action.id ? { ...i, status: action.status } : i)),
          audit: withAudit(state, action.status === 'APPROVED' ? 'inspection.approved' : 'inspection.flagged', `inspections / ${action.id}`),
        },
      }
    case 'submitInspection':
      return {
        ...state,
        done: mark('submittedInspection'),
        data: {
          ...d,
          inspections: [
            {
              id: `i${counter++}`,
              vehicleId: action.vehicleId,
              driverId: 'd1',
              type: action.kind,
              status: 'SUBMITTED',
              at: Date.now(),
              note: action.note.trim() || undefined,
              autoFlagged: action.brakesPoor,
            },
            ...d.inspections,
          ],
        },
      }

    case 'finalizeBilling': {
      const lines = billableTrips(d)
      return {
        ...state,
        done: mark('finalizedBilling'),
        data: {
          ...d,
          billing: { status: 'FINALIZED', lines },
          audit: withAudit(state, 'billing.finalized', 'billingPeriods / current', `${lines.length} trips, ${lines.reduce((s, l) => s + l.fare, 0).toFixed(2)} USD`),
        },
      }
    }
    case 'reopenBilling':
      return { ...state, data: { ...d, billing: { status: 'DRAFT', lines: [] } } }
    case 'exportBilling':
      return { ...state, done: mark('exportedBilling'), data: { ...d, billing: { ...d.billing, status: 'EXPORTED' } } }

    case 'setPayrollAmount':
      return { ...state, data: { ...d, payroll: { ...d.payroll, amounts: { ...d.payroll.amounts, [action.driverId]: action.value } } } }
    case 'approvePayroll': {
      const total = Object.values(d.payroll.amounts).reduce((s, v) => s + (Number(v) || 0), 0)
      return {
        ...state,
        done: mark('approvedPayroll'),
        data: { ...d, payroll: { ...d.payroll, status: 'APPROVED' }, audit: withAudit(state, 'payroll.approved', 'payrollPeriods / current', `total ${total.toFixed(2)} USD`) },
      }
    }
    case 'reopenPayroll':
      return { ...state, data: { ...d, payroll: { ...d.payroll, status: 'DRAFT' } } }
    case 'exportPayroll':
      return { ...state, data: { ...d, payroll: { ...d.payroll, status: 'EXPORTED' } } }

    case 'setUserRole':
      return {
        ...state,
        done: mark('changedRole'),
        data: {
          ...d,
          users: d.users.map((u) => (u.id === action.id ? { ...u, role: action.role } : u)),
          audit: withAudit(state, 'user.role_changed', `users / ${action.id}`, `role: ${action.role}`),
        },
      }
    case 'toggleUser': {
      const target = d.users.find((u) => u.id === action.id)
      return {
        ...state,
        done: mark('toggledUser'),
        data: {
          ...d,
          users: d.users.map((u) => (u.id === action.id ? { ...u, active: !u.active } : u)),
          audit: withAudit(state, 'user.status_changed', `users / ${action.id}`, `status: ${target?.active ? 'DISABLED' : 'ACTIVE'}`),
        },
      }
    }
  }
}

export interface DemoContextValue {
  state: State
  dispatch: (action: Action) => void
  mark: (key: string) => void
  toast: string | null
  notify: (message: string) => void
}

export const DemoContext = createContext<DemoContextValue | undefined>(undefined)

/** Creates the demo store; DemoPage passes the result to DemoContext.Provider. */
export function useDemoStore(): DemoContextValue {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ data: initialData(), role: 'DISPATCHER' as UserRole, done: {} }))
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const notify = useCallback((message: string) => {
    setToast(message)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 3500)
  }, [])
  const mark = useCallback((key: string) => dispatch({ type: 'mark', key }), [])

  return useMemo(() => ({ state, dispatch, mark, toast, notify }), [state, mark, toast, notify])
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside DemoProvider')
  return ctx
}

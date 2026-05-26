import { type TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import type { AppDispatch, State } from '../types/state';

const useAppDispatch = () => useDispatch<AppDispatch>();
const useAppSelector: TypedUseSelectorHook<State> = useSelector;

export { useAppDispatch, useAppSelector };

import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { pollTimeout } from '@/const/behaviour';
import {
  getConnectionId,
  getConnectionInvitation,
  getConnectionIsLoading,
  getConnections,
  getConnectionState,
  getIsConnectionsLoading,
  getIsExistingConnectionSelected,
} from '@/entities/Connection/model/selectors/connectionSelector';
import { createConnection } from '@/entities/Connection/model/services/createConnection';
import { fetchConnections } from '@/entities/Connection/model/services/fetchConnections';
import { updateConnectionState } from '@/entities/Connection/model/services/updateConnectionState';
import { connectionActions } from '@/entities/Connection/model/slices/connectionSlice';
import { ConnectionState } from '@/entities/Connection/model/types/connection';
import { useAppDispatch } from '@/shared/lib/hooks/useAppDispatch';

export interface UseConnectionParams {
  onComplete: (connectionId?: string) => void;
  useDemo?: boolean;
}

export function useConnection({ onComplete, useDemo }: UseConnectionParams) {
  const dispatch = useAppDispatch();

  const [connectionAlias, setConnectionAlias] = useState<string>('');
  // False until this step has replaced whatever session the slice held before it mounted
  const [isStarted, setIsStarted] = useState(false);

  const connectionId = useSelector(getConnectionId);
  const connectionInvitation = useSelector(getConnectionInvitation);
  const connectionState = useSelector(getConnectionState);
  const isInvitationLoading = useSelector(getConnectionIsLoading);
  const connections = useSelector(getConnections);
  const isConnectionsLoading = useSelector(getIsConnectionsLoading);
  const isExistingConnectionSelected = useSelector(
    getIsExistingConnectionSelected,
  );

  useEffect(() => {
    // Not every route resets the slice when a flow ends, and a completed session left over
    // from the previous flow would immediately trigger onComplete with its old connection
    dispatch(connectionActions.reset());
    dispatch(createConnection({ useDemo }));
    dispatch(fetchConnections({ useDemo }));
    setIsStarted(true);
  }, [dispatch, useDemo]);

  useEffect(() => {
    if (
      isStarted &&
      connectionId &&
      connectionState !== ConnectionState.Completed
    ) {
      const polling = setInterval(() => {
        dispatch(
          updateConnectionState({
            id: connectionId,
            useDemo,
          }),
        );
      }, pollTimeout);
      return () => clearInterval(polling);
    }
  }, [isStarted, connectionId, connectionState, dispatch, useDemo]);

  useEffect(() => {
    if (isStarted && connectionState === ConnectionState.Completed) {
      onComplete(connectionId);
    }
  }, [isStarted, connectionState, onComplete, connectionId]);

  // A new invitation is only safe while no wallet has started connecting to the current one
  const canRename =
    !!connectionInvitation &&
    !isInvitationLoading &&
    connectionState === ConnectionState.Start;

  const renameInvitation = useCallback(
    (alias: string) => {
      const trimmed = alias.trim();
      if (!canRename || trimmed === connectionAlias) return;
      setConnectionAlias(trimmed);
      dispatch(createConnection({ useDemo, alias: trimmed }));
    },
    [canRename, connectionAlias, dispatch, useDemo],
  );

  const selectConnection = useCallback(
    (id: string) => {
      dispatch(connectionActions.selectExistingConnection(id));
    },
    [dispatch],
  );

  const restartWithQr = useCallback(() => {
    dispatch(connectionActions.reset());
    dispatch(createConnection({ useDemo, alias: connectionAlias }));
    dispatch(fetchConnections({ useDemo }));
  }, [connectionAlias, dispatch, useDemo]);

  return {
    connectionId,
    connectionInvitation,
    connectionState,
    connections,
    isConnectionsLoading,
    isExistingConnectionSelected,
    connectionAlias,
    canRename,
    renameInvitation,
    selectConnection,
    restartWithQr,
  };
}

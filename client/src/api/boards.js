/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import http from './http';
import socket from './socket';
import { transformCard } from './cards';
import { transformAttachment } from './attachments';
import { getAccessToken } from '../utils/access-token-storage';
import Config from '../constants/Config';

/* Actions */

const createBoard = (projectId, data, headers) =>
  socket.post(`/projects/${projectId}/boards`, data, headers);

const createBoardWithImport = (projectId, data, requestId, headers) => {
  const { importMapping, ...formDataFields } = data;

  let url = `/projects/${projectId}/boards?requestId=${requestId}`;
  if (importMapping) {
    url += `&importMapping=${encodeURIComponent(importMapping)}`;
  }

  return http.post(url, formDataFields, headers);
}


const getBoard = (id, subscribe, headers) =>
  socket
    .get(`/boards/${id}${subscribe ? '?subscribe=true' : ''}`, undefined, headers)
    .then((body) => ({
      ...body,
      included: {
        ...body.included,
        cards: body.included.cards.map(transformCard),
        attachments: body.included.attachments.map(transformAttachment),
      },
    }));

const updateBoard = (id, data, headers) => socket.patch(`/boards/${id}`, data, headers);

const deleteBoard = (id, headers) => socket.delete(`/boards/${id}`, undefined, headers);

const previewFocalboardImport = (file) => {
  const accessToken = getAccessToken();

  const formData = new FormData();
  formData.append('file', file);

  return fetch(`${Config.SERVER_BASE_URL}/api/focalboard/preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
    credentials: 'include',
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((body) => {
          throw body;
        });
      }
      return response.json();
    });
};

export default {
  createBoard,
  createBoardWithImport,
  getBoard,
  updateBoard,
  deleteBoard,
  previewFocalboardImport,
};

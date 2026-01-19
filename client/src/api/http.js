/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import Config from '../constants/Config';

const http = {};

// TODO: add all methods
['GET', 'POST', 'DELETE'].forEach((method) => {
  http[method.toLowerCase()] = (url, data, headers) => {
    console.log('http.js received data:', data);

  const formData =
    data &&
    Object.keys(data).reduce((result, key) => {
      console.log(`Appending to FormData: ${key} =`, data[key]);
      result.append(key, data[key]);
      return result;
    }, new FormData());

  // Log what's in FormData
  if (formData) {
    console.log('FormData entries:');
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value);
    }
  }

    return fetch(`${Config.SERVER_BASE_URL}/api${url}`, {
      method,
      headers,
      body: formData,
      credentials: 'include',
    })
      .then((response) =>
        response.json().then((body) => ({
          body,
          isError: response.status !== 200,
        })),
      )
      .then(({ body, isError }) => {
        if (isError) {
          throw body;
        }

        return body;
      });
  };
});

export default http;

/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /focalboard/preview:
 *   post:
 *     summary: Preview Focalboard import file
 *     description: Parses a Focalboard JSONL export file and returns available properties for user selection before import.
 *     tags:
 *       - Focalboard
 *     operationId: previewFocalboardImport
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Focalboard JSONL export file
 *     responses:
 *       200:
 *         description: File parsed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - board
 *                 - properties
 *                 - views
 *               properties:
 *                 board:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                 properties:
 *                   type: array
 *                   description: Available card properties for mapping
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [text, number, select, multiSelect, date, person, multiPerson, file, checkbox, url, email, phone, createdTime, createdBy, updatedTime, updatedBy, unknown]
 *                       options:
 *                         type: array
 *                         description: Options for select/multiSelect properties
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             value:
 *                               type: string
 *                             color:
 *                               type: string
 *                 views:
 *                   type: array
 *                   description: Available views (for column property detection)
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       type:
 *                         type: string
 *                       groupById:
 *                         type: string
 *                         description: Property ID used for column grouping in this view
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalCards:
 *                       type: number
 *                     totalTextBlocks:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         description: File upload or parsing error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                 message:
 *                   type: string
 */

const Errors = {
  NO_FILE_WAS_UPLOADED: {
    noFileWasUploaded: 'No file was uploaded',
  },
  INVALID_FILE: {
    invalidFile: 'Invalid Focalboard export file',
  },
};

module.exports = {
  inputs: {},

  exits: {
    noFileWasUploaded: {
      responseType: 'unprocessableEntity',
    },
    invalidFile: {
      responseType: 'unprocessableEntity',
    },
    uploadError: {
      responseType: 'unprocessableEntity',
    },
  },

  async fn(inputs, exits) {
    // Require authentication
    const { currentUser } = this.req;
    if (!currentUser) {
      throw { unauthorized: 'Unauthorized' };
    }

    // Receive uploaded file
    let files;
    try {
      files = await sails.helpers.utils.receiveFile(this.req.file('file'), false);
    } catch (error) {
      return exits.uploadError(error.message);
    }

    if (files.length === 0) {
      throw Errors.NO_FILE_WAS_UPLOADED;
    }

    const file = _.last(files);

    // Parse the Focalboard file
    let focalboardData;
    try {
      focalboardData = await sails.helpers.boards.parseFocalboardFile.with({
        file,
        previewOnly: true,
      });
    } catch (error) {
      if (error === 'invalidFile' || error.code === 'invalidFile') {
        throw Errors.INVALID_FILE;
      }
      throw error;
    }

    const { board, views, cardCount, textBlockCount, commentCount } = focalboardData;

    // Categorize properties for frontend dropdowns
    const properties = {
      columns: [],
      labels: [],
      dates: [],
      assignees: [],
      customFields: [],
    };

    for (const prop of board.cardProperties || []) {
      const normalized = {
        id: prop.id,
        name: prop.name,
        type: prop.type,
        options: prop.options || [],
      };

      switch (prop.type) {
        case 'select':
          properties.columns.push(normalized);
          break;
        case 'multiSelect':
          properties.labels.push(normalized);
          break;
        case 'date':
          properties.dates.push(normalized);
          break;
        case 'person':
        case 'multiPerson':
          properties.assignees.push(normalized);
          break;
        case 'text':
        case 'url':
        case 'number':
        case 'email':
        case 'phone':
        case 'checkbox':
          properties.customFields.push(normalized);
          break;
        default:
          // Skip: createdTime, createdBy, updatedTime, updatedBy, file, unknown
          break;
      }
    }

    // Suggest column property from the kanban view
    const kanbanView = views.find((v) => v.fields?.viewType === 'board');
    const suggestedColumnPropertyId = kanbanView?.fields?.groupById || null;

    // Extract view info for column property detection
    const viewsInfo = views.map((view) => ({
      id: view.id,
      title: view.title,
      type: view.fields?.viewType || 'unknown',
      groupById: view.fields?.groupById || null,
    }));

    return exits.success({
      board: {
        id: board.id,
        title: board.title,
        description: board.description || null,
      },
      properties,
      suggestedColumnPropertyId,
      views: viewsInfo,
      stats: {
        totalCards: cardCount,
        totalTextBlocks: textBlockCount,
        totalComments: commentCount,
      },
    });
  },
};

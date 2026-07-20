/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link,
  List,
  Alignment,
  Font,
  FontFamily,
  FontSize,
  FontColor,
  FontBackgroundColor,
  Table,
  TableToolbar,
  TableColumnResize,
  TableProperties,
  TableCellProperties,
  RemoveFormat,
  PasteFromOffice,
  Image,
  ImageUpload,
  ImageToolbar,
  ImageStyle,
  ImageResize,
  type Editor,
  type FileLoader,
  type UploadAdapter,
  type UploadResponse
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * Adaptateur d'upload d'images CKEditor branché sur notre endpoint dédié
 * POST /api/upload/image (mêmes contraintes que le reste de l'app : jpg/png/webp/gif/svg, 5 Mo max).
 */
class BackendImageUploadAdapter implements UploadAdapter {
  private loader: FileLoader;
  private xhr?: XMLHttpRequest;

  constructor(loader: FileLoader) {
    this.loader = loader;
  }

  upload(): Promise<UploadResponse> {
    return this.loader.file.then(
      (file) =>
        new Promise<UploadResponse>((resolve, reject) => {
          this._initRequest();
          this._initListeners(resolve, reject, file as File);
          this._sendRequest(file as File);
        })
    );
  }

  abort() {
    this.xhr?.abort();
  }

  private _initRequest() {
    const xhr = (this.xhr = new XMLHttpRequest());
    xhr.open('POST', '/api/upload/image', true);
    xhr.responseType = 'json';
    // L'endpoint exige une session authentifiée : le cookie httpOnly `edg_session` est envoyé
    // automatiquement par le navigateur (requête de même origine), aucun jeton à manipuler ici.
  }

  private _initListeners(
    resolve: (value: UploadResponse) => void,
    reject: (reason?: unknown) => void,
    file: File
  ) {
    const xhr = this.xhr!;
    const loader = this.loader;
    const genericErrorText = `Impossible de téléverser l'image : ${file.name}.`;

    xhr.addEventListener('error', () => reject(genericErrorText));
    xhr.addEventListener('abort', () => reject());
    xhr.addEventListener('load', () => {
      const response = xhr.response;
      if (!response || response.status !== 'success' || !response.url) {
        reject(response?.detail || genericErrorText);
        return;
      }
      resolve({ default: response.url });
    });

    if (xhr.upload) {
      xhr.upload.addEventListener('progress', (evt) => {
        if (evt.lengthComputable) {
          loader.uploadTotal = evt.total;
          loader.uploaded = evt.loaded;
        }
      });
    }
  }

  private _sendRequest(file: File) {
    const data = new FormData();
    data.append('file', file);
    this.xhr!.send(data);
  }
}

function BackendImageUploadPlugin(editor: Editor) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader: FileLoader) =>
    new BackendImageUploadAdapter(loader);
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  return (
    <div className="rich-text-editor rounded-b-lg border border-slate-250 dark:border-slate-800 overflow-hidden">
      <CKEditor
        editor={ClassicEditor}
        data={value}
        config={{
          licenseKey: 'GPL',
          plugins: [
            Essentials, Paragraph, Bold, Italic, Underline, Strikethrough, Link, List, Alignment,
            Font, FontFamily, FontSize, FontColor, FontBackgroundColor,
            Table, TableToolbar, TableColumnResize, TableProperties, TableCellProperties,
            RemoveFormat, PasteFromOffice,
            Image, ImageUpload, ImageToolbar, ImageStyle, ImageResize,
            BackendImageUploadPlugin
          ],
          toolbar: {
            items: [
              'undo', 'redo', '|',
              'fontFamily', 'fontSize', '|',
              'bold', 'italic', 'underline', 'strikethrough', '|',
              'fontColor', 'fontBackgroundColor', '|',
              'alignment', '|',
              'bulletedList', 'numberedList', '|',
              'link', 'insertTable', 'uploadImage', '|',
              'removeFormat'
            ],
            shouldNotGroupWhenFull: true
          },
          image: {
            toolbar: ['imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|', 'toggleImageCaption', 'imageTextAlternative', '|', 'resizeImage']
          },
          table: {
            contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties']
          },
          fontFamily: {
            supportAllValues: true
          },
          fontSize: {
            options: [10, 12, 14, 'default', 18, 20, 24, 28, 32],
            supportAllValues: true
          },
          placeholder: placeholder || 'Saisissez votre contenu ici...'
        }}
        onChange={(_event, editor) => {
          onChange(editor.getData());
        }}
      />
    </div>
  );
}

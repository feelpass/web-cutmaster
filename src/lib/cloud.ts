// Firestore 클라우드 프로젝트 저장소.
// 경로: users/{uid}/projects/{projectId} — 문서 내용은 .cutmaster JSON(schemaVersion 4)과 동일.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { projectFromJson, projectToJson, type Project } from './domain/models';
import { firestore } from './firebase';

export interface CloudProjectMeta {
  id: string;
  name: string;
  updatedAt: string;
  partCount: number;
}

function projectsCol(uid: string) {
  return collection(firestore(), 'users', uid, 'projects');
}

export async function saveProjectToCloud(uid: string, project: Project): Promise<void> {
  const json = projectToJson({ ...project, updatedAt: new Date().toISOString() });
  await setDoc(doc(projectsCol(uid), project.id), json);
}

export async function listCloudProjects(uid: string): Promise<CloudProjectMeta[]> {
  const snap = await getDocs(query(projectsCol(uid), orderBy('updatedAt', 'desc')));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: (data.name as string) ?? '(이름 없음)',
      updatedAt: (data.updatedAt as string) ?? '',
      partCount: Array.isArray(data.parts) ? data.parts.length : 0,
    };
  });
}

export async function loadCloudProject(uid: string, projectId: string): Promise<Project | null> {
  const snap = await getDoc(doc(projectsCol(uid), projectId));
  if (!snap.exists()) return null;
  return projectFromJson(snap.data());
}

export async function deleteCloudProject(uid: string, projectId: string): Promise<void> {
  await deleteDoc(doc(projectsCol(uid), projectId));
}

import React, { useState, useEffect, useRef } from 'react';
import { Select, Card, Button, Table, Collapse, Input, Space, Checkbox } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';
import { api } from '../../services/authService';
import { degrees, branchMap } from '../admin/ManageSemesters/branchMap';
import AddBucketModal from './addBucketModal';
import Swal from 'sweetalert2';

const { Option } = Select;

const CourseRecommendation = () => {
  const [batches, setBatches] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSemesterNumber, setSelectedSemesterNumber] = useState('');
  const [selectedRegulationId, setSelectedRegulationId] = useState('');
  const [pccCourses, setPccCourses] = useState([]);
  const [electives, setElectives] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [courseInfo, setCourseInfo] = useState({});
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddBucketModal, setShowAddBucketModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedVerticalPerBucket, setSelectedVerticalPerBucket] = useState({});
  const [selectedCoursesPerBucket, setSelectedCoursesPerBucket] = useState({});

  useEffect(() => {
    console.log('Current state:', {
      loading,
      selectedDegree,
      selectedDept,
      selectedBatch,
      selectedSemester,
      selectedRegulationId,
      selectedSemesterNumber,
      semesters,
    });
  }, [loading, selectedDegree, selectedDept, selectedBatch, selectedSemester, selectedRegulationId, selectedSemesterNumber, semesters]);

  useEffect(() => {
    const fetchInitialData = async () => {
      console.log('Fetching initial data, setting loading to true');
      setLoading(true);
      try {
        const batchRes = await api.get('/admin/batches');
        console.log('Batches response:', batchRes.data);
        if (batchRes.data.status === 'success') {
          setBatches([...new Set(batchRes.data.data.map(b => b.batch))]);
        } else {
          throw new Error(batchRes.data.message || 'Failed to fetch batches');
        }
      } catch (err) {
        const errorMessage = `Failed to fetch initial data: ${err.message}`;
        console.error('Batch fetch error:', err.response?.data || err);
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        console.log('Finished fetching initial data, setting loading to false');
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedDegree || !selectedDept || !selectedBatch) return;
    const fetchBatchAndSemesters = async () => {
      setLoading(true);
      setError(null);
      try {
        const batchParams = { degree: selectedDegree, branch: selectedDept, batch: selectedBatch };
        console.log('Fetching batch with params:', batchParams);
        const batchRes = await api.get('/admin/batches/find', { params: batchParams });
        console.log('Batch API response:', batchRes.data);
        if (batchRes.data.status === 'success') {
          const regulationId = batchRes.data.data.regulationId;
          console.log('Selected Regulation ID:', regulationId);
          if (!regulationId) {
            console.warn('No regulationId found in batch response');
            setError('No regulation assigned to this batch. Please assign a regulation.');
            toast.warn('No regulation assigned to this batch. Some features may be limited.');
          }
          setSelectedRegulationId(regulationId || '');
        } else {
          throw new Error(batchRes.data.message || 'Batch not found');
        }

        const semParams = { degree: selectedDegree, branch: selectedDept, batch: selectedBatch };
        console.log('Fetching semesters with params:', semParams);
        const semRes = await api.get('/admin/semesters/by-batch-branch', { params: semParams });
        console.log('Semester response:', semRes.data);
        if (semRes.data.status === 'success') {
          setSemesters(semRes.data.data);
          console.log('Semesters set:', semRes.data.data);
          if (semRes.data.data.length === 0) {
            setError('No semesters found. Please create a semester.');
            toast.info('No semesters found. Please create a semester.');
          }
        } else {
          throw new Error(semRes.data.message || 'Failed to fetch semesters');
        }

        if (batchRes.data.data.regulationId) {
          const verticalRes = await api.get(`/admin/regulations/${batchRes.data.data.regulationId}/verticals`);
          console.log('Verticals response:', verticalRes.data);
          if (verticalRes.data.status === 'success') {
            setVerticals(verticalRes.data.data);
            const verticalIds = verticalRes.data.data.map(v => v.verticalId);
            const coursePromises = verticalIds.map(vid =>
              api.get(`/admin/regulations/verticals/${vid}/courses`, {
                params: { semesterNumber: selectedSemesterNumber || '1' },
              })
            );
            const courseResponses = await Promise.all(coursePromises);
            let allCourses = [];
            verticalRes.data.data.forEach((vert, index) => {
              const res = courseResponses[index];
              if (res && res.data.status === 'success') {
                allCourses.push(
                  ...res.data.data
                    .filter(c => ['PEC', 'OEC'].includes(c.category))
                    .map(c => ({ ...c, verticalId: vert.verticalId, verticalName: vert.verticalName }))
                );
              }
            });
            setElectives(allCourses);
            console.log('Electives set:', allCourses);
          }
        }
      } catch (err) {
        const errorMessage =
          err.response?.status === 404
            ? `No batch or semesters found for ${selectedDegree} - ${selectedDept} (${selectedBatch}). Create batch/semester first.`
            : `Failed to fetch: ${err.response?.data?.message || err.message}`;
        console.error('Fetch error:', err.response?.data || err);
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchBatchAndSemesters();
  }, [selectedDegree, selectedDept, selectedBatch]);

  useEffect(() => {
    console.log('Semester selection:', { selectedSemester, semesters });
    if (selectedSemester) {
      const sem = semesters.find(s => s.semesterId === selectedSemester);
      if (sem) {
        setSelectedSemesterNumber(sem.semesterNumber.toString());
        console.log('Selected Semester Number:', sem.semesterNumber);
      } else {
        console.warn('No semester found for selectedSemester:', selectedSemester);
      }
    }
  }, [selectedSemester, semesters]);

  useEffect(() => {
    if (!selectedSemester) return;
    const fetchCoursesAndBuckets = async () => {
      setLoading(true);
      try {
        const courseRes = await api.get(`/admin/semesters/${selectedSemester}/courses`);
        if (courseRes.data.status === 'success') {
          setPccCourses(courseRes.data.data.filter(c => c.category === 'PCC'));
        } else {
          throw new Error(courseRes.data.message || 'Failed to fetch courses');
        }
        const bucketRes = await api.get(`/admin/semesters/${selectedSemester}/buckets`);
        console.log('Buckets response:', bucketRes.data);
        if (bucketRes.data.status === 'success') {
          setBuckets(bucketRes.data.data);
        } else {
          throw new Error(bucketRes.data.message || 'Failed to fetch buckets');
        }
      } catch (err) {
        const errorMessage = `Failed to fetch courses or buckets: ${err.response?.data?.message || err.message}`;
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchCoursesAndBuckets();
  }, [selectedSemester]);

  useEffect(() => {
    const info = {};
    electives.forEach(e => {
      info[e.courseCode] = {
        verticalId: e.verticalId,
        verticalName: e.verticalName,
        courseTitle: e.courseTitle,
      };
    });
    setCourseInfo(info);
    console.log('CourseInfo set:', info);
  }, [electives]);

  const handleAddBucket = () => {
    console.log('handleAddBucket called', { selectedSemester, selectedRegulationId, selectedSemesterNumber });
    if (!selectedSemester || !selectedRegulationId || !selectedSemesterNumber) {
      toast.error('Please select Degree, Department, Batch, and Semester first');
      return;
    }
    console.log('Setting showAddBucketModal to true');
    setShowAddBucketModal(true);
  };

  const handleBucketAdded = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/semesters/${selectedSemester}/buckets`);
      console.log('Updated buckets response:', res.data);
      if (res.data.status === 'success') {
        setBuckets(res.data.data);
        toast.success('Bucket created successfully');
      }
    } catch (err) {
      setError(`Failed to fetch updated buckets: ${err.response?.data?.message || err.message}`);
      toast.error(`Failed to fetch updated buckets: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBucketName = async (bucketId, newName) => {
    if (!newName.trim()) {
      toast.error('Bucket name cannot be empty');
      return;
    }
    setLoading(true);
    try {
      const res = await api.put(`/admin/buckets/${bucketId}`, { bucketName: newName });
      if (res.data.status === 'success') {
        setBuckets(buckets.map(b => (b.bucketId === bucketId ? { ...b, bucketName: newName } : b)));
        toast.success('Bucket name updated successfully');
      }
    } catch (err) {
      setError(`Failed to update bucket name: ${err.response?.data?.message || err.message}`);
      toast.error(`Failed to update bucket name: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBucket = async (bucketId) => {
    const result = await Swal.fire({
      title: 'Delete Bucket',
      text: 'Are you sure you want to delete this bucket?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    setLoading(true);
    try {
      const res = await api.delete(`/admin/buckets/${bucketId}`);
      if (res.data.status === 'success') {
        setBuckets(buckets.filter(b => b.bucketId !== bucketId));
        toast.success('Bucket deleted successfully');
      }
    } catch (err) {
      setError(`Failed to delete bucket: ${err.response?.data?.message || err.message}`);
      toast.error(`Failed to delete bucket: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerticalSelect = (bucketId, value) => {
    setSelectedVerticalPerBucket(prev => ({ ...prev, [bucketId]: value }));
    setSelectedCoursesPerBucket(prev => ({ ...prev, [bucketId]: [] }));
  };

  const handleCourseSelect = (bucketId, checked) => {
    setSelectedCoursesPerBucket(prev => ({ ...prev, [bucketId]: checked }));
  };

  const handleAddSelectedCourses = async (bucketId) => {
    const selected = selectedCoursesPerBucket[bucketId] || [];
    if (!selected.length) {
      toast.error('Please select at least one course');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/admin/buckets/${bucketId}/courses`, { courseCodes: selected });
      if (res.data.status === 'success') {
        const bucketRes = await api.get(`/admin/semesters/${selectedSemester}/buckets`);
        if (bucketRes.data.status === 'success') {
          setBuckets(bucketRes.data.data);
          toast.success('Courses added to bucket successfully');
          setSelectedVerticalPerBucket(prev => ({ ...prev, [bucketId]: undefined }));
          setSelectedCoursesPerBucket(prev => ({ ...prev, [bucketId]: [] }));
        }
      }
    } catch (err) {
      setError(`Failed to add courses: ${err.response?.data?.message || err.message}`);
      toast.error(`Failed to add courses: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCourseFromBucket = async (bucketId, courseCode) => {
    const result = await Swal.fire({
      title: 'Remove Course',
      text: `Are you sure you want to remove ${courseCode} from the bucket?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;
    setLoading(true);
    try {
      const res = await api.delete(`/admin/buckets/${bucketId}/courses/${courseCode}`);
      if (res.data.status === 'success') {
        const bucketRes = await api.get(`/admin/semesters/${selectedSemester}/buckets`);
        if (bucketRes.data.status === 'success') {
          setBuckets(bucketRes.data.data);
          toast.success(`Course ${courseCode} removed successfully`);
        }
      }
    } catch (err) {
      setError(`Failed to remove course: ${err.response?.data?.message || err.message}`);
      toast.error(`Failed to remove course: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRecommendation = () => {
    setShowPreview(true);
  };

  const assignedCourses = buckets.flatMap(bucket => bucket.courses.map(c => c.courseCode));

  const pccColumns = [
    { title: 'Course Code', dataIndex: 'courseCode', key: 'courseCode' },
    { title: 'Course Title', dataIndex: 'courseTitle', key: 'courseTitle' },
  ];

  const getGroupedCourses = (courses) => {
    return courses.reduce((acc, c) => {
      const v = c.verticalName || 'Unassigned';
      if (!acc[v]) acc[v] = [];
      acc[v].push(c);
      return acc;
    }, {});
  };

  const collapseItems = buckets.map(bucket => ({
    key: bucket.bucketId,
    label: (
      <div className="flex justify-between items-center">
        <Input
          defaultValue={bucket.bucketName || `Elective ${bucket.bucketNumber}`}
          onBlur={e => handleUpdateBucketName(bucket.bucketId, e.target.value)}
          style={{ width: 200, marginRight: 8 }}
        />
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={e => {
            e.stopPropagation();
            handleDeleteBucket(bucket.bucketId);
          }}
        >
          Delete
        </Button>
      </div>
    ),
    children: (
      <>
        {bucket.courses.length > 0 ? (
          Object.entries(getGroupedCourses(bucket.courses)).map(([vertical, courses]) => (
            <div key={vertical}>
              <h4 className="font-semibold">{vertical}</h4>
              <ul className="space-y-2 mb-4">
                {courses.map(c => (
                  <li key={c.courseCode} className="flex justify-between">
                    <span>
                      {c.courseCode} - {c.courseTitle}
                    </span>
                    <Button
                      danger
                      size="small"
                      onClick={() => handleRemoveCourseFromBucket(bucket.bucketId, c.courseCode)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p>No courses in this bucket.</p>
        )}
        <Select
          placeholder="Select Vertical"
          style={{ width: '100%', marginBottom: 16 }}
          value={selectedVerticalPerBucket[bucket.bucketId]}
          onChange={value => handleVerticalSelect(bucket.bucketId, value)}
          disabled={loading || verticals.length === 0}
        >
          {verticals.map(v => (
            <Option key={v.verticalId} value={v.verticalId}>
              {v.verticalName}
            </Option>
          ))}
        </Select>
        {selectedVerticalPerBucket[bucket.bucketId] && (
          <div>
            <Checkbox.Group
              style={{ width: '100%' }}
              value={selectedCoursesPerBucket[bucket.bucketId] || []}
              onChange={checked => handleCourseSelect(bucket.bucketId, checked)}
            >
              {electives
                .filter(
                  e =>
                    e.verticalId === selectedVerticalPerBucket[bucket.bucketId] &&
                    !assignedCourses.includes(e.courseCode)
                )
                .map(e => (
                  <Checkbox
                    key={e.courseCode}
                    value={e.courseCode}
                    style={{ display: 'block', marginBottom: 8 }}
                  >
                    {e.courseCode} - {e.courseTitle}
                  </Checkbox>
                ))}
            </Checkbox.Group>
            <Button
              type="primary"
              onClick={() => handleAddSelectedCourses(bucket.bucketId)}
              disabled={loading || !(selectedCoursesPerBucket[bucket.bucketId]?.length > 0)}
            >
              Add Selected Courses
            </Button>
          </div>
        )}
      </>
    ),
  }));

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-4">Course Recommendation</h1>
      {error && <div className="mb-4 text-red-600">{error}</div>}
      {loading && <div className="mb-4">Loading...</div>}

      <Card className="mb-6">
        <Space wrap>
          <div>
            <label className="block mb-1">Degree</label>
            <Select
              value={selectedDegree}
              onChange={(value) => {
                console.log('Selected Degree:', value);
                setSelectedDegree(value);
                setSelectedDept('');
                setSelectedBatch('');
                setSelectedSemester('');
                setSelectedRegulationId('');
                setSelectedSemesterNumber('');
                setSemesters([]);
              }}
              disabled={loading}
              style={{ width: 200 }}
              placeholder="Select Degree"
            >
              {degrees.map(deg => (
                <Option key={deg} value={deg}>
                  {deg}
                </Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block mb-1">Department</label>
            <Select
              value={selectedDept}
              onChange={(value) => {
                console.log('Selected Dept:', value);
                setSelectedDept(value);
                setSelectedBatch('');
                setSelectedSemester('');
                setSelectedRegulationId('');
                setSelectedSemesterNumber('');
                setSemesters([]);
              }}
              disabled={loading || !selectedDegree}
              style={{ width: 200 }}
              placeholder="Select Department"
            >
              {Object.entries(branchMap).map(([acronym, deptname]) => (
                <Option key={acronym} value={acronym}>
                  {deptname}
                </Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block mb-1">Batch</label>
            <Select
              value={selectedBatch}
              onChange={(value) => {
                console.log('Selected Batch:', value);
                setSelectedBatch(value);
                setSelectedSemester('');
                setSelectedRegulationId('');
                setSelectedSemesterNumber('');
                setSemesters([]);
              }}
              disabled={loading || !selectedDegree || !selectedDept}
              style={{ width: 200 }}
              placeholder="Select Batch"
            >
              {batches.map(b => (
                <Option key={b} value={b}>
                  {b}
                </Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block mb-1">Semester</label>
            <Select
              value={selectedSemester}
              onChange={(value) => {
                console.log('Selected Semester:', value);
                setSelectedSemester(value);
              }}
              disabled={loading || !selectedDegree || !selectedDept || !selectedBatch}
              style={{ width: 200 }}
              placeholder="Select Semester"
            >
              {semesters.map(s => (
                <Option key={s.semesterId} value={s.semesterId}>
                  Semester {s.semesterNumber}
                </Option>
              ))}
            </Select>
          </div>
        </Space>
      </Card>

      {selectedSemester && (
        <>
          <h2 className="text-2xl font-bold mb-4">Core Courses</h2>
          <Card className="mb-6">
            {pccCourses.length > 0 ? (
              <Table
                columns={pccColumns}
                dataSource={pccCourses}
                rowKey="courseCode"
                pagination={false}
              />
            ) : (
              <p>No core courses available.</p>
            )}
          </Card>

          <div className="flex justify-between mb-4">
            <h2 className="text-2xl font-bold">Elective Buckets</h2>
            <Button
              type="primary"
              onClick={handleAddBucket}
              disabled={loading || !selectedSemester || !selectedRegulationId || !selectedSemesterNumber}
            >
              Add Elective Bucket
            </Button>
          </div>
          {buckets.length > 0 ? (
            <Collapse items={collapseItems} />
          ) : (
            <p>No buckets created yet. Click "Add Elective Bucket" to start.</p>
          )}

          <Button
            type="primary"
            size="large"
            onClick={handleSubmitRecommendation}
            disabled={loading || buckets.length === 0}
            className="mt-6"
          >
            Submit Recommendation
          </Button>

          {showPreview && (
            <Card title="Recommendation Preview" className="mt-6">
              <h3 className="text-xl font-bold">Core Courses</h3>
              {pccCourses.length > 0 ? (
                <ul className="list-disc pl-5 mb-4">
                  {pccCourses.map(c => (
                    <li key={c.courseCode}>
                      {c.courseCode} - {c.courseTitle}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No core courses.</p>
              )}
              <h3 className="text-xl font-bold">Elective Buckets</h3>
              {buckets.map(bucket => (
                <div key={bucket.bucketId} className="mb-4">
                  <h4 className="font-semibold">{bucket.bucketName || `Elective ${bucket.bucketNumber}`}</h4>
                  {bucket.courses.length > 0 ? (
                    Object.entries(getGroupedCourses(bucket.courses)).map(([vertical, courses]) => (
                      <div key={vertical}>
                        <h5>{vertical}</h5>
                        <ul className="list-disc pl-5">
                          {courses.map(c => (
                            <li key={c.courseCode}>
                              {c.courseCode} - {c.courseTitle}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p>No courses in this bucket.</p>
                  )}
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {showAddBucketModal && (
        <AddBucketModal
          semesterId={selectedSemester}
          regulationId={selectedRegulationId}
          semesterNumber={selectedSemesterNumber}
          assignedCourses={assignedCourses}
          onBucketAdded={handleBucketAdded}
          setShowAddBucketModal={setShowAddBucketModal}
        />
      )}
    </div>
  );
};

export default CourseRecommendation;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Button, Select, Form, Table, Spin, Card, Tooltip, Skeleton, Badge, Space, Typography, Divider } from 'antd';
import { DownloadOutlined, InfoCircleOutlined, SearchOutlined, BookOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);
const { Option } = Select;
const { Title, Text } = Typography;

const SubjectWiseMarks = () => {
  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedSem, setSelectedSem] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [fullData, setFullData] = useState({ students: [], courses: [], marks: {} });
  const [displayedData, setDisplayedData] = useState({ students: [], courses: [], marks: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form] = Form.useForm();

  const api = axios.create({
    baseURL: 'http://localhost:4000/api',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [batchRes, deptRes] = await Promise.all([
          api.get('/admin/batches'),
          api.get('/departments'),
        ]);
        const batchData = batchRes.data.data || [];
        const deptData = deptRes.data.data || [];
        setBatches(batchData);
        setDepartments(deptData);
        if (batchData.length === 0) {
          setError('No batches available. Please contact the administrator.');
          MySwal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'No batches available',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        }
        if (deptData.length === 0) {
          setError('No departments available. Please contact the administrator.');
          MySwal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'No departments available',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        }
      } catch (err) {
        const errorMsg = err.response?.data?.message || 'Failed to fetch initial data';
        setError(errorMsg);
        MySwal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: errorMsg,
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchSemesters = async () => {
      if (selectedBatch && selectedDept) {
        setLoading(true);
        try {
          const selectedBatchData = batches.find((b) => String(b.batchId) === String(selectedBatch));
          if (!selectedBatchData) {
            setError('Selected batch not found.');
            MySwal.fire({
              toast: true,
              position: 'top-end',
              icon: 'error',
              title: 'Selected batch not found',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
            });
            return;
          }
          const res = await api.get(
            `/admin/semesters/by-batch-branch?batch=${encodeURIComponent(selectedBatchData.batch)}&branch=${encodeURIComponent(selectedBatchData.branch)}&degree=${encodeURIComponent(selectedBatchData.degree)}`
          );
          const semesterData = res.data.data || [];
          setSemesters(semesterData);
          if (semesterData.length === 0) {
            setError(`No semesters found for batch ${selectedBatchData.batch} - ${selectedBatchData.branch}`);
            MySwal.fire({
              toast: true,
              position: 'top-end',
              icon: 'warning',
              title: `No semesters found for batch ${selectedBatchData.batch} - ${selectedBatchData.branch}`,
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true,
            });
          }
        } catch (err) {
          const errorMsg = err.response?.data?.message || 'Failed to fetch semesters';
          setError(errorMsg);
          MySwal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: errorMsg,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        } finally {
          setLoading(false);
        }
      } else {
        setSemesters([]);
        setSelectedSem(null);
        form.setFieldsValue({ sem: null });
      }
    };
    fetchSemesters();
  }, [selectedBatch, selectedDept, batches, form]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedBatch || !selectedDept || !selectedSem) return;
      setLoading(true);
      setError(null);
      setCourses([]);
      setSelectedCourse(null);
      setFullData({ students: [], courses: [], marks: {} });
      setDisplayedData({ students: [], courses: [], marks: {} });
      try {
        const selectedBatchData = batches.find((b) => String(b.batchId) === String(selectedBatch));
        const selectedDeptData = departments.find((d) => String(d.Deptid) === String(selectedDept));
        const params = {
          batch: selectedBatchData?.batch || selectedBatch,
          dept: selectedDeptData?.Deptacronym || selectedDept,
          sem: selectedSem,
        };
        console.log('Sending request with params:', params);
        const res = await api.get('/admin/consolidated-marks', { params });
        console.log('API response:', JSON.stringify(res.data, null, 2));
        const { students, courses, marks, message } = res.data.data;
        if (message) {
          setError(message);
          MySwal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: message,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        } else if (courses.length === 0) {
          setError('No courses found for the selected semester.');
          MySwal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: 'No courses found for the selected semester',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        } else if (students.length === 0) {
          setError('No students found for the selected criteria.');
          MySwal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: 'No students found for the selected criteria',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        } else if (Object.keys(marks).length === 0) {
          setError('No marks available for the selected courses.');
          MySwal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: 'No marks available. Please ensure course outcomes and marks are configured.',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
        }
        setFullData({ students, courses, marks });
        setCourses(courses);
        console.log('Marks data:', marks);
      } catch (err) {
        const errorMsg = err.response?.data?.message || 'Failed to fetch consolidated marks';
        setError(errorMsg);
        MySwal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: errorMsg,
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedBatch, selectedDept, selectedSem]);

  useEffect(() => {
    if (selectedCourse && fullData.courses.length > 0) {
      const selCourseObj = fullData.courses.find(c => c.courseCode === selectedCourse);
      if (selCourseObj) {
        const dispCourses = [selCourseObj];
        const dispMarks = {};
        fullData.students.forEach(student => {
          dispMarks[student.regno] = {
            [selectedCourse]: fullData.marks[student.regno]?.[selectedCourse] || {}
          };
        });
        setDisplayedData({
          students: fullData.students,
          courses: dispCourses,
          marks: dispMarks
        });
      }
    } else {
      setDisplayedData({
        students: fullData.students,
        courses: [],
        marks: {}
      });
    }
  }, [selectedCourse, fullData]);

  const exportToExcel = () => {
    const { students, courses, marks } = displayedData;
    if (!students.length || !courses.length) {
      MySwal.fire({
        toast: true,
        position: 'top-end',
        icon: 'error',
        title: 'No data to export',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    const header1 = ['Roll No', 'Name'];
    const header2 = ['', ''];
    const merges = [];
    let currentCol = 2;

    courses.forEach(course => {
      const numSub = (course.theoryCount > 0 ? 1 : 0) +
                     (course.practicalCount > 0 ? 1 : 0) +
                     (course.experientialCount > 0 ? 1 : 0);
      if (numSub > 0) {
        header1.push(...Array(numSub).fill(course.courseTitle));
        merges.push({ s: { r: 0, c: currentCol }, e: { r: 0, c: currentCol + numSub - 1 } });
        if (course.theoryCount > 0) header2.push('T');
        if (course.practicalCount > 0) header2.push('P');
        if (course.experientialCount > 0) header2.push('E');
        currentCol += numSub;
      }
    });

    const rows = [header1, header2];
    students.forEach(student => {
      const row = [student.regno, student.name];
      courses.forEach(course => {
        const studentMarks = marks[student.regno]?.[course.courseCode] || {};
        if (course.theoryCount > 0) row.push(studentMarks.theory || '-');
        if (course.practicalCount > 0) row.push(studentMarks.practical || '-');
        if (course.experientialCount > 0) row.push(studentMarks.experiential || '-');
      });
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = merges;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Subject Wise Marks');
    XLSX.writeFile(wb, `subject_wise_marks_${selectedBatch}_${selectedDept}_${selectedSem}_${selectedCourse || 'all'}.xlsx`);
    MySwal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Data exported successfully',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  };

  const columns = [
    { 
      title: 'Roll No', 
      dataIndex: 'regno', 
      key: 'regno', 
      fixed: 'left', 
      width: 120,
    },
    { 
      title: 'Student Name', 
      dataIndex: 'name', 
      key: 'name', 
      fixed: 'left', 
      width: 220,
      render: (text) => <span className="font-medium text-gray-800">{text}</span>
    },
    ...displayedData.courses.map(course => {
      const children = [];
      if (course.theoryCount > 0) {
        children.push({
          title: <Badge color="#1890ff" text="Theory" />,
          key: `${course.courseCode}_T`,
          width: 100,
          align: 'center',
          render: (record) => {
            const mark = displayedData.marks[record.regno]?.[course.courseCode]?.theory;
            return mark ? (
              <span className={`px-2 py-1 rounded ${mark >= 50 ? ' text-green-700' : ' text-red-700'}`}>
                {mark}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            );
          },
        });
      }
      if (course.practicalCount > 0) {
        children.push({
          title: <Badge color="#52c41a" text="Practical" />,
          key: `${course.courseCode}_P`,
          width: 100,
          align: 'center',
          render: (record) => {
            const mark = displayedData.marks[record.regno]?.[course.courseCode]?.practical;
            return mark ? (
              <span className={`px-2 py-1 rounded ${mark >= 50 ? ' text-green-700' : ' text-red-700'}`}>
                {mark}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            );
          },
        });
      }
      if (course.experientialCount > 0) {
        children.push({
          title: <Badge color="#fa8c16" text="Experiential" />,
          key: `${course.courseCode}_E`,
          width: 120,
          align: 'center',
          render: (record) => {
            const mark = displayedData.marks[record.regno]?.[course.courseCode]?.experiential;
            return mark ? (
              <span className={`px-2 py-1 rounded ${mark >= 50 ? ' text-green-700' : ' text-red-700'}`}>
                {mark}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            );
          },
        });
      }

      return {
        title: (
          <div className="text-center">
            <div className="font-semibold text-blue-800">{course.courseTitle}</div>
            <div className="text-xs text-gray-500 mt-1">{course.courseCode}</div>
          </div>
        ),
        key: course.courseCode,
        children,
      };
    }),
  ];

  const getSelectedBatchInfo = () => {
    if (!selectedBatch) return null;
    const batch = batches.find(b => String(b.batchId) === String(selectedBatch));
    return batch;
  };

  const getSelectedDeptInfo = () => {
    if (!selectedDept) return null;
    const dept = departments.find(d => String(d.Deptid) === String(selectedDept));
    return dept;
  };

  const getSelectedCourseInfo = () => {
    if (!selectedCourse) return null;
    const course = courses.find(c => c.courseCode === selectedCourse);
    return course;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Filter Section */}
        <Card 
          className="mb-6 shadow-lg border-0 bg-white"
          bodyStyle={{ padding: '32px' }}
        >
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
              <div className="flex items-center">
                {/* <InfoCircleOutlined className="text-red-400 mr-2" /> */}
                <Text className="text-red-700">{error}</Text>
              </div>
            </div>
          )}

            <Title level={3} className="text-blue-800 mb-2">
                    Subject Wise Marks Report
            </Title>

          <Spin spinning={loading}>
            <Form form={form} layout="vertical">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                <Form.Item
                  label={
                    <span className="text-gray-700 font-semibold flex items-center">
                      <CalendarOutlined className="mr-2 text-blue-600" />
                      Academic Batch
                      <Tooltip title="Select the academic batch (e.g., 2023-2027)">
                        {/* <InfoCircleOutlined className="ml-2 text-blue-400" /> */}
                      </Tooltip>
                    </span>
                  }
                >
                  <Select
                    value={selectedBatch}
                    onChange={(value) => {
                      setSelectedBatch(value);
                      setSelectedDept(null);
                      setSelectedSem(null);
                      setSelectedCourse(null);
                      form.setFieldsValue({ dept: null, sem: null, course: null });
                    }}
                    placeholder="Choose academic batch"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    size="large"
                    className="w-full"
                  >
                    {batches.map(batch => (
                      <Option key={batch.batchId} value={batch.batchId}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{batch.batchYears}</span>
                          <span className="text-blue-600 text-sm">
                            {batch.degree} - {batch.branch}
                          </span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  label={
                    <span className="text-gray-700 font-semibold flex items-center">
                      <BookOutlined className="mr-2 text-blue-600" />
                      Department
                      <Tooltip title="Select the department (e.g., Computer Science)">
                        {/* <InfoCircleOutlined className="ml-2 text-blue-400" /> */}
                      </Tooltip>
                    </span>
                  }
                  name="dept"
                >
                  <Select
                    value={selectedDept}
                    onChange={(value) => {
                      setSelectedDept(value);
                      setSelectedSem(null);
                      setSelectedCourse(null);
                      form.setFieldsValue({ sem: null, course: null });
                    }}
                    placeholder="Choose department"
                    disabled={!selectedBatch}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    size="large"
                    className="w-full"
                  >
                    {departments.map(dept => (
                      <Option key={dept.Deptid} value={dept.Deptid}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{dept.Deptname}</span>
                          {/* <Badge 
                            color="blue" 
                            text={dept.Deptacronym} 
                            className="text-xs"
                          /> */}
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  label={
                    <span className="text-gray-700 font-semibold flex items-center">
                      <CalendarOutlined className="mr-2 text-blue-600" />
                      Semester
                    </span>
                  }
                  name="sem"
                >
                  <Select
                    value={selectedSem}
                    onChange={(value) => {
                      setSelectedSem(value);
                      setSelectedCourse(null);
                      form.setFieldsValue({ course: null });
                    }}
                    placeholder="Choose semester"
                    disabled={!selectedDept}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    size="large"
                    className="w-full"
                  >
                    {semesters.map(sem => (
                      <Option key={sem.semesterId} value={sem.semesterNumber}>
                        <div className="flex items-center">
                          {/* <Badge count={sem.semesterNumber} color="blue" className="mr-2" /> */}
                          <span className="font-medium">Semester {sem.semesterNumber}</span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  label={
                    <span className="text-gray-700 font-semibold flex items-center">
                      <BookOutlined className="mr-2 text-blue-600" />
                      Subject
                    </span>
                  }
                  name="course"
                >
                  <Select
                    value={selectedCourse}
                    onChange={setSelectedCourse}
                    placeholder="Choose subject"
                    disabled={!selectedSem || courses.length === 0}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    size="large"
                    className="w-full"
                  >
                    {courses.map(course => (
                      <Option key={course.courseCode} value={course.courseCode}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{course.courseTitle}</span>
                          <span className="text-blue-600 text-sm">{course.courseCode}</span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>

              {/* Selection Summary */}
              {(selectedBatch || selectedDept || selectedSem || selectedCourse) && (
                <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-200">
                  <Title level={5} className="text-blue-800 mb-3">Current Selection:</Title>
                  <Space wrap>
                    {selectedBatch && (
                      <Badge 
                        color="blue" 
                        text={`Batch: ${getSelectedBatchInfo()?.batchYears || selectedBatch}`} 
                      />
                    )}
                    {selectedDept && (
                      <Badge 
                        color="green" 
                        text={`Dept: ${getSelectedDeptInfo()?.Deptname || selectedDept}`} 
                      />
                    )}
                    {selectedSem && (
                      <Badge 
                        color="orange" 
                        text={`Semester: ${selectedSem}`} 
                      />
                    )}
                    {selectedCourse && (
                      <Badge 
                        color="purple" 
                        text={`Subject: ${getSelectedCourseInfo()?.courseTitle || selectedCourse}`} 
                      />
                    )}
                  </Space>
                </div>
              )}
            </Form>
          </Spin>
        </Card>

        {/* Results Section */}
        {loading && displayedData.students.length === 0 && (
          <Card className="shadow-lg">
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        )}

        {displayedData.students.length === 0 && !loading && !error && (
          <Card className="text-center shadow-lg bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="py-12">
              <BookOutlined className="text-6xl text-gray-300 mb-4" />
              <Title level={3} className="text-gray-500 mb-2">No Data Available</Title>
              <Text className="text-gray-400 text-lg">
                Please select a batch, department, semester, and subject to view marks
              </Text>
            </div>
          </Card>
        )}

        {displayedData.students.length > 0 && (
          <Card 
            className="shadow-xl border-0"
            title={
              <div className="flex justify-between items-center">
                <div>
                  <Space>
                    <Badge color="blue" text={`${displayedData.students.length} Students`} />
                    <Badge color="green" text={`${displayedData.courses.length} Course`} />
                  </Space>
                </div>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={exportToExcel}
                  size="large"
                  className="bg-green-600 hover:bg-green-700 border-0 shadow-lg"
                >
                  Export to Excel
                </Button>
              </div>
            }
            bodyStyle={{ padding: '24px' }}
          >
            <Table
              dataSource={displayedData.students}
              columns={columns}
              rowKey="regno"
              scroll={{ x: 'max-content' }}
              pagination={{ 
                pageSize: 10, 
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `Total ${total} students`
              }}
              bordered
              size="middle"
              className="shadow-sm"
              rowClassName={(record, index) => 
                index % 2 === 0 ? 'bg-blue-50' : 'bg-white'
              }
            />
          </Card>
        )}
      </div>
    </div>
  );
};

export default SubjectWiseMarks;